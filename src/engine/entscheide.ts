// Entscheide der Spieler:in anwenden und prüfen.
import { ANWERBUNG, B, HALLEN } from './config';
import { aktuelleWoche } from './kalender';
import { alter, name, stufeFuerAlter, teamKinder, teamsDerStufe } from './personen';
import type { Entscheid, GameState, Stufe, Team } from './types';
import { STUFEN, TRAINER_ROLLEN } from './types';
import { erstelleInstanz, loeseEreignis, wendeEffekteAn, type EffektKontext } from './ereignisse';
import { ereignisVorlage, aktivitaetDef } from './config';
import { neuerAntrag } from './vorstand';
import { aktivitaetMoeglich, aktivitaetStarten } from './anlaesse';
import { postVeroeffentlichen } from './social';
import { absoluteWoche } from './kalender';
import { dialogAbkuehlungAktiv, dialogAuswerten, personVon } from './dialoge';
import { elternabend } from './eltern';
import { offenbare } from './infos';
import { Rng } from './rng';
import { neueId } from './util';
import { buchen } from './finanzen';

export interface AnwerbungAuftrag {
  massnahmeId: string;
  zielStufe?: Stufe;
}

export interface EntscheidErgebnis {
  fehler: string[];
  anwerbungen: AnwerbungAuftrag[];
}

const SCHWERPUNKTE = ['spass', 'technik', 'kondition', 'taktik', 'spielformen'];

export function beitraegeAenderbar(state: GameState): boolean {
  return aktuelleWoche(state).phase === 'vorbereitung';
}

export function teamGruendenMoeglich(state: GameState, stufe: Stufe): string | null {
  if (state.wettkampf.gestartet) return 'Neue Teams können nur vor dem Meisterschaftsstart gegründet werden.';
  if (teamsDerStufe(state, stufe).length >= 3) return 'Pro Stufe sind höchstens drei Teams möglich.';
  return null;
}

function teamBuchstabe(state: GameState, stufe: Stufe): string {
  const vergeben = new Set(teamsDerStufe(state, stufe).map((t) => t.name));
  for (const b of ['A', 'B', 'C', 'D']) {
    if (!vergeben.has(`${stufe} ${b}`) && !(b === 'A' && vergeben.has(stufe))) return b;
  }
  return 'X';
}

export function neuesTeam(state: GameState, stufe: Stufe, name?: string, halle?: string): Team {
  const vorhandene = teamsDerStufe(state, stufe);
  // Erstes Team heisst wie die Stufe; ab dem zweiten bekommen alle Buchstaben
  if (vorhandene.length === 1 && vorhandene[0]!.name === stufe) vorhandene[0]!.name = `${stufe} A`;
  const t: Team = {
    id: neueId(state, 'team'),
    name: name ?? (vorhandene.length === 0 ? stufe : `${stufe} ${teamBuchstabe(state, stufe)}`),
    stufe,
    trainer: [],
    plan: { ...STANDARD_PLAENE[stufe] },
    halle: halle ?? HALLEN[STUFEN.indexOf(stufe) % HALLEN.length]!,
    absagenInFolge: 0,
    absagenSaison: 0,
    flags: {},
    elternabende: 0
  };
  state.teams[t.id] = t;
  return t;
}

export const STANDARD_PLAENE: Record<Stufe, Team['plan']> = {
  U9: { trainingsProWoche: 1, schwerpunkt: 'spass' },
  U12: { trainingsProWoche: 2, schwerpunkt: 'spielformen' },
  U15: { trainingsProWoche: 2, schwerpunkt: 'technik' },
  U18: { trainingsProWoche: 2, schwerpunkt: 'taktik' }
};

/**
 * Wendet Entscheide auf den Spielstand an (mutiert `state`).
 * Ereignis-Entscheide werden nur angewendet, wenn `ereignisKontext` übergeben wird.
 */
export function wendeEntscheideAn(
  state: GameState,
  entscheide: Entscheid[],
  rng: Rng | null,
  ereignisKontext: EffektKontext | null
): EntscheidErgebnis {
  const fehler: string[] = [];
  const anwerbungen: AnwerbungAuftrag[] = [];
  let gespraeche = 0;
  const gespraechMitPerson = new Set<string>();
  let posts = 0;
  let vorbereitet = false;

  for (const e of entscheide) {
    switch (e.typ) {
      case 'trainerZuteilen': {
        const t = state.trainer[e.trainerId];
        const team = state.teams[e.teamId];
        if (!t || t.status !== 'aktiv' || !team) {
          fehler.push('Trainer:in oder Team nicht gefunden.');
          break;
        }
        if (!TRAINER_ROLLEN.includes(e.rolle)) {
          fehler.push(`Unbekannte Rolle ${e.rolle}.`);
          break;
        }
        const vorhanden = team.trainer.find((x) => x.trainerId === t.id);
        if (vorhanden) {
          vorhanden.rolle = e.rolle;
        } else {
          if (team.trainer.length >= B.trainer.maxTeamgroesse) {
            fehler.push(`${team.name} hat bereits ${B.trainer.maxTeamgroesse} Trainer:innen.`);
            break;
          }
          team.trainer.push({ trainerId: t.id, rolle: e.rolle });
        }
        // nur eine Haupttrainer:in pro Team
        if (e.rolle === 'haupttrainer') {
          for (const x of team.trainer) if (x.trainerId !== t.id && x.rolle === 'haupttrainer') x.rolle = 'cotrainer';
        }
        break;
      }
      case 'trainerEntfernen': {
        const team = state.teams[e.teamId];
        if (!team) break;
        team.trainer = team.trainer.filter((x) => x.trainerId !== e.trainerId);
        break;
      }
      case 'trainingsplan': {
        const team = state.teams[e.teamId];
        if (!team) {
          fehler.push('Team nicht gefunden.');
          break;
        }
        const n = Math.round(e.plan.trainingsProWoche);
        if (n < 0 || n > B.training.trainingsProWocheMax || !SCHWERPUNKTE.includes(e.plan.schwerpunkt)) {
          fehler.push('Ungültiger Trainingsplan.');
          break;
        }
        team.plan = { trainingsProWoche: n, schwerpunkt: e.plan.schwerpunkt };
        break;
      }
      case 'kindVerschieben': {
        const k = state.kinder[e.kindId];
        const team = state.teams[e.teamId];
        if (!k || !team || k.status === 'ausgetreten') {
          fehler.push('Kind oder Team nicht gefunden.');
          break;
        }
        if (stufeFuerAlter(alter(state, k)) !== team.stufe) {
          fehler.push(`${name(k)} gehört nicht in die Stufe ${team.stufe}.`);
          break;
        }
        k.teamId = team.id;
        break;
      }
      case 'teamGruenden': {
        const grund = teamGruendenMoeglich(state, e.stufe);
        if (grund) {
          fehler.push(grund);
          break;
        }
        neuesTeam(state, e.stufe);
        break;
      }
      case 'teamAufloesen': {
        const team = state.teams[e.teamId];
        if (!team) break;
        const andere = teamsDerStufe(state, team.stufe).filter((t) => t.id !== team.id);
        if (andere.length === 0) {
          fehler.push('Das letzte Team einer Stufe kann nicht aufgelöst werden.');
          break;
        }
        if (state.wettkampf.gestartet) {
          fehler.push('Während der laufenden Saison können keine Teams aufgelöst werden.');
          break;
        }
        const ziel = andere[0]!;
        for (const k of teamKinder(state, team.id)) k.teamId = ziel.id;
        delete state.teams[team.id];
        if (andere.length === 1 && ziel.name === `${ziel.stufe} A`) ziel.name = ziel.stufe;
        break;
      }
      case 'kinderAufteilen': {
        const teams = teamsDerStufe(state, e.stufe);
        if (teams.length < 2) break;
        const kinder = teams
          .flatMap((t) => teamKinder(state, t.id))
          .sort((a, b) => a.geburtsjahr - b.geburtsjahr || a.id.localeCompare(b.id));
        kinder.forEach((k, i) => {
          k.teamId = teams[i % teams.length]!.id;
        });
        break;
      }
      case 'anwerbung': {
        const m = ANWERBUNG.find((x) => x.id === e.massnahmeId);
        if (!m) {
          fehler.push('Unbekannte Anwerbungsmassnahme.');
          break;
        }
        anwerbungen.push({ massnahmeId: m.id, zielStufe: m.zielStufeWaehlbar ? e.zielStufe : undefined });
        break;
      }
      case 'beitrag': {
        if (!beitraegeAenderbar(state)) {
          fehler.push('Mitgliederbeiträge können nur in der Vorbereitung geändert werden.');
          break;
        }
        state.finanzen.beitraege[e.stufe] = Math.max(B.finanzen.beitragMin, Math.min(B.finanzen.beitragMax, Math.round(e.betrag)));
        break;
      }
      case 'geschwisterrabatt':
        if (!beitraegeAenderbar(state)) {
          fehler.push('Der Geschwisterrabatt kann nur in der Vorbereitung geändert werden.');
          break;
        }
        state.finanzen.geschwisterrabatt = Math.max(0, Math.min(100, Math.round(e.prozent)));
        break;
      case 'haertefallfonds':
        if (!beitraegeAenderbar(state)) {
          fehler.push('Der Härtefallfonds kann nur in der Vorbereitung geändert werden.');
          break;
        }
        state.finanzen.haertefallfonds = e.aktiv;
        break;
      case 'material':
        state.finanzen.material = e.niveau;
        break;
      case 'entschaedigung':
        state.finanzen.entschaedigung = e.niveau;
        break;
      case 'dialog': {
        const p = personVon(state, e.personId);
        if (!p) {
          fehler.push('Gesprächspartner:in nicht gefunden.');
          break;
        }
        if (!e.ereignisId) {
          if (gespraeche >= B.dialog.gespraecheProWoche) {
            fehler.push(`Pro Woche sind höchstens ${B.dialog.gespraecheProWoche} Gespräche möglich.`);
            break;
          }
          if (gespraechMitPerson.has(p.id)) {
            fehler.push(`Mit ${name(p)} ist diese Woche schon ein Gespräch geplant.`);
            break;
          }
          if (dialogAbkuehlungAktiv(state, p, e.dialogId)) {
            fehler.push(`Dieses Gespräch mit ${name(p)} fand erst kürzlich statt.`);
            break;
          }
        }
        const inst = e.ereignisId ? state.ereignisse.find((x) => x.id === e.ereignisId) : undefined;
        let z;
        try {
          z = dialogAuswerten(state, e.dialogId, e.personId, e.antworten, inst?.beteiligte ?? {});
        } catch (err) {
          fehler.push((err as Error).message);
          break;
        }
        if (z.fehler || !z.beendet) {
          fehler.push(z.fehler ?? `Das Gespräch «${z.dialog.titel}» wurde nicht abgeschlossen.`);
          break;
        }
        if (!e.ereignisId) gespraeche++;
        gespraechMitPerson.add(p.id);
        const delta = z.vertrauen - p.vertrauen;
        p.vertrauen = z.vertrauen;
        for (const info of z.offenbart) offenbare(p, info);
        if (p.rolle === 'elternteil') p.stimmung = Math.max(0, Math.min(100, p.stimmung + delta / 2));
        p.gespraeche.push({
          saison: state.saison,
          woche: state.woche,
          dialogId: e.dialogId,
          titel: z.dialog.titel,
          ergebnis: z.endText ?? '',
          vertrauensAenderung: Math.round(delta * 10) / 10
        });
        const r = rng ?? new Rng(state.rngState);
        const ctx = ereignisKontext ?? { buchungen: [], meldungen: [], schnupper: [] };
        wendeEffekteAn(state, r, z.effekte, z.beteiligte, ctx);
        break;
      }
      case 'elternabend': {
        const team = state.teams[e.teamId];
        if (!team) {
          fehler.push('Team nicht gefunden.');
          break;
        }
        if (team.elternabende >= B.eltern.elternabend.maxProSaison) {
          fehler.push(`${team.name} hatte diese Saison schon ${B.eltern.elternabend.maxProSaison} Elternabende.`);
          break;
        }
        const ctx = ereignisKontext ?? { buchungen: [], meldungen: [], schnupper: [] };
        elternabend(state, team, aktuelleWoche(state), ctx.buchungen, ctx.meldungen, ereignisKontext !== null);
        break;
      }
      case 'antrag': {
        if (state.vorstand.offeneAntraege.length >= B.vorstand.maxAntraegeProSitzung * 2) {
          fehler.push('Es sind schon genug Anträge für die nächsten Sitzungen offen.');
          break;
        }
        if (e.betrag < 0 || e.betrag > B.vorstand.maxBetrag) {
          fehler.push(`Anträge sind auf CHF ${B.vorstand.maxBetrag} begrenzt.`);
          break;
        }
        state.vorstand.offeneAntraege.push(neuerAntrag(state, e.antragTyp, e.betrag));
        break;
      }
      case 'antragZurueckziehen':
        state.vorstand.offeneAntraege = state.vorstand.offeneAntraege.filter((a) => a.id !== e.antragId);
        break;
      case 'sitzungVorbereiten': {
        if (vorbereitet) break;
        vorbereitet = true;
        const V = B.vorstand.vorbereitung;
        state.vorstand.vorbereitung = Math.min(V.maxPunkte, state.vorstand.vorbereitung + V.bericht);
        break;
      }
      case 'aktivitaet': {
        let def;
        try {
          def = aktivitaetDef(e.aktivitaetId);
        } catch {
          fehler.push('Unbekannte Aktivität.');
          break;
        }
        const grund = aktivitaetMoeglich(state, def);
        if (grund) {
          fehler.push(`${def.name}: ${grund}`);
          break;
        }
        const ctx = ereignisKontext ?? { buchungen: [], meldungen: [], schnupper: [] };
        aktivitaetStarten(state, def, ctx.buchungen, ctx.meldungen);
        break;
      }
      case 'post': {
        if (posts >= B.social.maxPostsProWoche) {
          fehler.push(`Pro Woche sind höchstens ${B.social.maxPostsProWoche} Posts sinnvoll.`);
          break;
        }
        posts++;
        const ctx = ereignisKontext ?? { buchungen: [], meldungen: [], schnupper: [] };
        const r = rng ?? new Rng(state.rngState);
        const { betroffen } = postVeroeffentlichen(state, r, e.postTyp, e.teamId, e.bilder, e.werbung, ctx.buchungen);
        if (betroffen && ereignisKontext) {
          const kind = (state.familien[betroffen.familieId]?.kinderIds ?? []).map((id) => state.kinder[id]).find((k) => k?.status === 'aktiv');
          erstelleInstanz(state, ereignisVorlage('post_ohne_einwilligung'), { elternteil: betroffen.id, kind: kind?.id, team: kind?.teamId ?? undefined }, {});
        }
        break;
      }
      case 'sponsorSuche':
        state.sponsorSucheBis = absoluteWoche(state) + B.sponsoren.sucheWochen;
        break;
      case 'helferBeenden': {
        const el = state.eltern[e.elternteilId];
        if (el) {
          el.helfer = null;
          el.helferTeamId = null;
        }
        break;
      }
      case 'ereignis': {
        if (!rng || !ereignisKontext) break;
        const inst = state.ereignisse.find((x) => x.id === e.ereignisId);
        if (!inst) {
          fehler.push('Ereignis nicht gefunden.');
          break;
        }
        if (inst.erledigt) break;
        try {
          loeseEreignis(state, rng, inst, e.optionId, ereignisKontext);
        } catch (err) {
          fehler.push((err as Error).message);
        }
        break;
      }
    }
  }
  return { fehler, anwerbungen };
}

/** Vorschau: wendet alle Entscheide ausser Ereignissen auf eine Kopie an. */
export function vorschau(state: GameState, entscheide: Entscheid[]): { state: GameState; fehler: string[] } {
  const kopie = JSON.parse(JSON.stringify(state)) as GameState;
  const { fehler } = wendeEntscheideAn(kopie, entscheide.filter((e) => e.typ !== 'ereignis'), null, null);
  return { state: kopie, fehler };
}

export function anwerbungsKosten(entscheide: Entscheid[]): number {
  return entscheide
    .filter((e): e is Extract<Entscheid, { typ: 'anwerbung' }> => e.typ === 'anwerbung')
    .reduce((s, e) => s + (ANWERBUNG.find((m) => m.id === e.massnahmeId)?.kosten ?? 0), 0);
}

export function bucheAnwerbung(state: GameState, a: AnwerbungAuftrag, ctx: EffektKontext): void {
  const m = ANWERBUNG.find((x) => x.id === a.massnahmeId);
  if (!m) return;
  buchen(state, { kategorie: 'anwerbung', text: m.name + (a.zielStufe ? ` (${a.zielStufe})` : ''), betrag: -m.kosten }, ctx.buchungen);
}

