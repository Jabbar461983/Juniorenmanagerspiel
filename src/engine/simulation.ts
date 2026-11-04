// Spielkern: simulateWeek(state, decisions) → { state, events, report }
// Reine Funktion: Der übergebene Spielstand wird nicht verändert, aller Zufall
// kommt aus dem seed-basierten Generator im Spielstand.
import { ANWERBUNG, B, ereignisVorlage } from './config';
import { bucheAnwerbung, wendeEntscheideAn } from './entscheide';
import {
  erstelleInstanz,
  ereignisKontext,
  erzeugeEreignisse,
  loeseEreignis,
  neuesSchnupperkind,
  offeneEreignisse,
  offenePflichtEreignisse,
  type EffektKontext
} from './ereignisse';
import { beitragsFaktor, beitragsFaktorSchnitt, buchen, haertefallAktiv } from './finanzen';
import { elternWoche, familieVernetzen, interessenkonflikte, ohneTransport, zahlungen } from './eltern';
import { absoluteWoche, aktuelleWoche } from './kalender';
import {
  aktiveKinder,
  aktiveTrainer,
  alter,
  durchschnittZufriedenheit,
  name,
  stufeFuerAlter,
  teamKinder,
  teamTrainer,
  teamsVonTrainer
} from './personen';
import { Rng } from './rng';
import { saisonAbschliessen } from './saison';
import { endbewertung } from './bewertung';
import { anlaesseWoche } from './anlaesse';
import { reichweiteFaktor, socialWoche } from './social';
import { sponsorenSaisonstart, sponsorenWoche } from './sponsoren';
import { generalversammlung, sitzung, vereinsPruefung } from './vorstand';
import type { Entscheid, GameState, Id, Kind, Stufe, WochenBericht, WochenErgebnis } from './types';
import { clamp, klonen, neueId, round1 } from './util';
import { eigeneStaerke, einsatzzeiten, hatWettkampf, simuliereWettkampfWoche, starteWettkampf } from './wettkampf';
import { naechsteZufriedenheit, negativFaktor, siegFaktor, teamKontext, zielFaktoren, zielwert, type TeamKontext } from './zufriedenheit';

export class PflichtEreignisOffenError extends Error {
  constructor(public ereignisIds: Id[]) {
    super(`Offene Pflicht-Ereignisse müssen zuerst bearbeitet werden (${ereignisIds.length}).`);
    this.name = 'PflichtEreignisOffenError';
  }
}

export class SpielBeendetError extends Error {
  constructor() {
    super('Das Spiel ist beendet.');
    this.name = 'SpielBeendetError';
  }
}

const STUFEN_REIHENFOLGE: Record<Stufe, number> = { U9: 0, U12: 1, U15: 2, U18: 3 };

function trainingsFortschritt(state: GameState, k: Kind, ctx: TeamKontext, trainings: number, faktor: number, rng: Rng): number {
  const T = B.training;
  const sp = B.schwerpunkte[ctx.team.plan.schwerpunkt];
  const basis =
    T.grundFortschritt +
    (ctx.werte.skills.fachwissen / 100) * T.fachwissenEinfluss +
    (k.werte.talent / 20) * T.talentEinfluss;
  const motivation = 0.6 + k.werte.motivation / 25;
  let summe = 0;
  for (const skill of ['technik', 'kondition', 'spielverstaendnis'] as const) {
    const aktuell = k.werte[skill];
    // Obergrenze steigt mit Talent und Alter
    const grenze = Math.min(T.maxWert, k.werte.talent + 2 + alter(state, k) * 0.3);
    const raum = clamp((grenze - aktuell) / grenze, 0, 1);
    const gain = basis * sp[skill] * trainings * faktor * motivation * raum * rng.float(0.7, 1.3);
    k.werte[skill] = clamp(Math.round((aktuell + gain) * 1000) / 1000, 1, T.maxWert);
    summe += gain;
  }
  return summe;
}

export function simulateWeek(input: GameState, decisions: Entscheid[]): WochenErgebnis {
  if (input.spielende) throw new SpielBeendetError();
  const state = klonen(input);
  const rng = new Rng(state.rngState);
  const info = aktuelleWoche(state);
  const abwKinder = info.ferien ? info.ferien.abwesenheitKinder : B.abwesenheit.normal;

  // 1. Pflicht-Ereignisse müssen entschieden sein
  const entschieden = new Set(decisions.filter((d) => d.typ === 'ereignis').map((d) => (d as { ereignisId: Id }).ereignisId));
  const fehlend = offenePflichtEreignisse(state).filter((e) => !entschieden.has(e.id));
  if (fehlend.length > 0) throw new PflichtEreignisOffenError(fehlend.map((e) => e.id));

  const report: WochenBericht = {
    saison: state.saison,
    woche: state.woche,
    datum: info.montag,
    phase: info.phase,
    ferien: info.ferien?.name ?? null,
    mitgliederVorher: aktiveKinder(state).length,
    mitgliederNachher: 0,
    zufriedenheitVorher: round1(durchschnittZufriedenheit(state)),
    zufriedenheitNachher: 0,
    kasseVorher: state.finanzen.kasse,
    kasseNachher: 0,
    buchungen: [],
    eintritte: [],
    austritte: [],
    schnupper: [],
    spiele: [],
    trainings: [],
    meldungen: [],
    fehler: []
  };
  const ectx: EffektKontext = { buchungen: report.buchungen, meldungen: report.meldungen, schnupper: [] };

  // 2. Entscheide anwenden (inkl. Ereignisse)
  const { fehler, anwerbungen } = wendeEntscheideAn(state, decisions, rng, ectx);
  report.fehler.push(...fehler);

  // 3. Abgelaufene, nicht bearbeitete Ereignisse mit Standardoption erledigen
  for (const inst of offeneEreignisse(state)) {
    if (!inst.pflicht && inst.ablaufWoche <= absoluteWoche(state)) {
      const standard = standardOption(inst.vorlageId, inst.verfuegbareOptionen);
      loeseEreignis(state, rng, inst, standard, ectx);
      report.meldungen.push(`Keine Reaktion auf «${inst.titel}»: ${inst.erledigt?.text ?? ''}`);
    }
  }

  // 4. Saisonstart / Wettkampfstart
  if (state.woche === 1 && state.saison >= 2) {
    buchen(state, { kategorie: 'vereinsbeitrag', text: 'Jahresbudget (Beschluss der GV)', betrag: state.vorstand.jahresbudget }, report.buchungen);
    sponsorenSaisonstart(state, report.buchungen, report.meldungen);
  }
  if (!state.wettkampf.gestartet && info.phase === 'meisterschaft') {
    starteWettkampf(state, rng);
    const teams = Object.values(state.teams);
    const lizenzen = aktiveKinder(state).filter((k) => {
      const t = k.teamId ? state.teams[k.teamId] : undefined;
      return t && t.stufe !== 'U9';
    }).length;
    buchen(
      state,
      { kategorie: 'verbandsgebuehren', text: `Teamgebühren (${teams.length} Teams)`, betrag: -teams.length * B.finanzen.verbandTeamgebuehr },
      report.buchungen
    );
    buchen(state, { kategorie: 'verbandsgebuehren', text: `Spielerlizenzen (${lizenzen})`, betrag: -lizenzen * B.finanzen.verbandLizenzProKind }, report.buchungen);
    report.meldungen.push('Die Meisterschaft beginnt! Spielpläne sind erstellt.');
  }

  // 5. Anwerbung
  const eintrittsFaktor =
    Math.max(0.2, 1 - B.eintritt.beitragElastizitaet * (beitragsFaktorSchnitt(state) - 1)) *
    (1 + (state.verein.ruf - 50) * B.eintritt.rufEinfluss) *
    reichweiteFaktor(state);
  for (const a of anwerbungen) {
    const m = ANWERBUNG.find((x) => x.id === a.massnahmeId)!;
    bucheAnwerbung(state, a, ectx);
    const [rmin, rmax] = m.reichweite as [number, number];
    const anzahl = Math.round(rng.int(rmin, rmax) * eintrittsFaktor);
    let [amin, amax] = m.alter as [number, number];
    if (a.zielStufe) {
      amin = B.stufen[a.zielStufe].alterMin;
      amax = B.stufen[a.zielStufe].alterMax;
    }
    let erreicht = 0;
    for (let i = 0; i < anzahl; i++) {
      const k = neuesSchnupperkind(state, rng, rng.int(amin, amax));
      if (k) {
        ectx.schnupper.push(k);
        erreicht++;
      }
    }
    report.meldungen.push(`${m.name}: ${erreicht} Kind${erreicht === 1 ? '' : 'er'} melden sich zum Schnuppern an.`);
  }

  // 6. Trainings
  const kontexte: Record<Id, TeamKontext> = {};
  const trainerLast: Record<Id, number> = {};
  for (const team of Object.values(state.teams)) {
    const anpassung = state.trainingsAnpassungen[team.id];
    const trainer = teamTrainer(state, team);
    let trainings = team.plan.trainingsProWoche;
    let text = '';
    if (trainer.length === 0) {
      trainings = 0;
      text = 'Kein Training: Es ist niemand im Trainerteam.';
    } else if (anpassung === 'absagen') {
      trainings = 0;
      text = 'Training abgesagt.';
    }
    if (anpassung === 'absagen' || (trainer.length === 0 && team.plan.trainingsProWoche > 0)) {
      team.absagenInFolge += 1;
      team.absagenSaison += 1;
    } else if (trainings > 0) {
      team.absagenInFolge = 0;
    }
    const ctx = teamKontext(state, team, trainings);
    ctx.anpassung = anpassung;
    const partner = state.zusammenlegungen[team.id];
    if (anpassung === 'zusammenlegen' && partner && state.teams[partner]) {
      ctx.zusammengelegtJuenger = STUFEN_REIHENFOLGE[team.stufe] < STUFEN_REIHENFOLGE[state.teams[partner]!.stufe];
    }
    kontexte[team.id] = ctx;

    if (trainings > 0) {
      const faktor =
        anpassung === 'reduziert' ? 0.5 : anpassung === 'zusammenlegen' || anpassung === 'aussenplatz' ? 0.8 : anpassung === 'kleingruppe' ? 1.1 : 1;
      for (const k of teamKinder(state, team.id)) {
        const anwesend = rng.chance(1 - abwKinder);
        const gain = anwesend ? trainingsFortschritt(state, k, ctx, trainings, faktor, rng) : 0;
        k.fortschritt = 0.8 * k.fortschritt + 0.2 * gain;
      }
      const miete =
        (anpassung === 'aussenplatz' || anpassung === 'zusammenlegen' ? 0 : anpassung === 'reduziert' ? 0.5 : 1) *
        (1 - state.vorstand.hallenRabatt);
      buchen(
        state,
        { kategorie: 'hallenmiete', text: `Halle ${team.name}`, betrag: -trainings * B.finanzen.hallenmieteProTraining * miete },
        report.buchungen
      );
      for (const t of trainer) trainerLast[t.id] = (trainerLast[t.id] ?? 0) + trainings;
      if (!text) {
        const zusatz: Record<string, string> = {
          zusammenlegen: ' (zusammengelegt)',
          kleingruppe: ' (Kleingruppen-Event)',
          reduziert: ' (halbe Halle)',
          aussenplatz: ' (Aussenplatz)'
        };
        text = `${trainings} Training${trainings === 1 ? '' : 's'}, Schwerpunkt ${team.plan.schwerpunkt}${anpassung ? (zusatz[anpassung] ?? '') : ''}.`;
      }
    } else {
      for (const k of teamKinder(state, team.id)) k.fortschritt = 0.8 * k.fortschritt;
      if (!text) text = 'Kein Training geplant.';
    }
    report.trainings.push({ teamId: team.id, text });
  }

  // 7. Wettkampf
  const staerken: Record<Id, number> = {};
  for (const team of Object.values(state.teams)) staerken[team.id] = eigeneStaerke(state, team, 1 - abwKinder);
  const spieleTeams = Object.values(state.teams).filter((t) => hatWettkampf(state, t, state.woche));
  const spielMeldungen = simuliereWettkampfWoche(state, rng, state.woche, staerken);
  for (const m of spielMeldungen) report.spiele.push({ stufe: m.stufe, text: m.text });
  for (const team of spieleTeams) {
    const kinder = teamKinder(state, team.id, false);
    const T2 = B.eltern.transport;
    const anwesend = kinder
      .filter((k) => {
        const ohne = ohneTransport(state, k);
        if (ohne) k.werte.motivation = clamp(k.werte.motivation - T2.motivationAbzug, 1, 20);
        return rng.chance((1 - abwKinder) * (ohne ? T2.anwesenheitOhneFahrdienst : 1));
      })
      .map((k) => k.id);
    const ez = einsatzzeiten(state, team, anwesend);
    if (!team.flags['einsatzregeln']) {
      for (const c of interessenkonflikte(state, team)) {
        for (const id of c.kindIds) if (ez[id] !== undefined) ez[id] = Math.min(1, ez[id]! + B.eltern.interessenkonflikt.einsatzBonus);
      }
    }
    for (const k of kinder) {
      const e = ez[k.id] ?? 0;
      k.einsatzzeit = 0.7 * k.einsatzzeit + 0.3 * e;
    }
    const ergebnisse = spielMeldungen.flatMap((m) => m.ergebnisse).filter((r) => r.teamId === team.id);
    if (ergebnisse.length > 0) {
      const schnitt = ergebnisse.reduce((s, r) => s + r.resultat, 0) / ergebnisse.length;
      for (const k of kinder) {
        const eff = schnitt > 0 ? B.wettkampf.siegZufriedenheit * schnitt * siegFaktor(k) : B.wettkampf.niederlageZufriedenheit * -schnitt * negativFaktor(k);
        k.offeneEffekte += eff;
      }
    }
    for (const t of teamTrainer(state, team)) trainerLast[t.id] = (trainerLast[t.id] ?? 0) + 0.5;
  }

  // 8. Trainer: Belastung und Motivation
  const T = B.trainer;
  for (const t of aktiveTrainer(state)) {
    const last = trainerLast[t.id] ?? 0;
    const teams = teamsVonTrainer(state, t.id).length;
    const ueber = Math.max(0, last - t.verfuegbarkeit);
    const erholung = info.ferien ? T.belastungFerienErholung : T.belastungErholung;
    t.belastung = clamp(
      t.belastung + last * T.belastungProTraining + ueber * T.belastungUeberVerfuegbarkeit + Math.max(0, teams - 1) * T.belastungProZusatzteam * 0.25 - erholung,
      0,
      100
    );
    t.motivation = clamp(
      t.motivation + B.finanzen.entschaedigungMotivation[state.finanzen.entschaedigung] + (t.belastung > 80 ? -0.3 : 0) + 0.03 * (14 - t.motivation),
      1,
      20
    );
    if (teams > 0 && (t.belastung >= T.ruecktrittBelastung || t.motivation < 4) && rng.chance(T.ruecktrittWochenWahrscheinlichkeit)) {
      t.status = 'zurueckgetreten';
      for (const team of teamsVonTrainer(state, t.id)) team.trainer = team.trainer.filter((x) => x.trainerId !== t.id);
      state.posteingang.push({
        id: neueId(state, 'n'),
        saison: state.saison,
        woche: state.woche,
        absender: name(t),
        titel: 'Rücktritt',
        text: `${name(t)} tritt per sofort zurück: «Ich kann nicht mehr.» Überlastung und fehlende Wertschätzung waren zu viel.`,
        gelesen: false,
        wichtig: true
      });
      report.meldungen.push(`${name(t)} ist zurückgetreten.`);
    }
  }

  // 9. Zufriedenheit
  for (const k of Object.values(state.kinder)) {
    if (k.status === 'ausgetreten') continue;
    const ctx = k.teamId ? (kontexte[k.teamId] ?? null) : null;
    const f = zielFaktoren(state, k, ctx);
    k.faktoren = f;
    k.zufriedenheit = round1(naechsteZufriedenheit(k.zufriedenheit, zielwert(f), k.offeneEffekte));
    k.offeneEffekte = 0;
    // Motivation folgt langsam der Zufriedenheit
    k.werte.motivation = clamp(round1(k.werte.motivation + 0.08 * (k.zufriedenheit / 5 - k.werte.motivation)), 1, 20);
  }
  elternWoche(state, info, new Set(spieleTeams.map((t) => t.id)), report.meldungen);

  // 10. Schnupperkinder entscheiden sich
  const neuIds = new Set(ectx.schnupper.map((k) => k.id));
  for (const k of Object.values(state.kinder)) {
    if (k.status !== 'schnupper' || neuIds.has(k.id)) continue;
    k.schnupperWochenRest -= 1;
    if (k.schnupperWochenRest > 0) continue;
    const stufe = k.teamId ? state.teams[k.teamId]?.stufe : stufeFuerAlter(alter(state, k));
    const bf = stufe ? beitragsFaktor(state, stufe) : 1;
    const p = clamp(
      (B.eintritt.bleibenBasis + B.eintritt.bleibenZufriedenheitFaktor * (k.zufriedenheit / 100)) *
        (1 - 0.5 * B.eintritt.beitragElastizitaet * (bf - 1)),
      0.05,
      0.97
    );
    if (rng.chance(p)) {
      k.status = 'aktiv';
      k.eintritt = { saison: state.saison, woche: state.woche };
      if (k.teamId) familieVernetzen(state, rng, k.familieId, k.teamId);
      state.saisonStatistik.eintritte++;
      report.eintritte.push({ id: k.id, name: name(k), text: `bleibt nach dem Schnuppern (${state.teams[k.teamId ?? '']?.name ?? '–'})` });
    } else {
      k.status = 'ausgetreten';
      k.austritt = { saison: state.saison, woche: state.woche, grund: 'nach dem Schnuppern nicht geblieben' };
      k.teamId = null;
      report.meldungen.push(`${name(k)} kommt nach dem Schnuppern nicht mehr.`);
    }
  }

  // 11. Austritte
  const A = B.austritt;
  const saisonende = state.woche === B.spiel.wochenProSaison;
  for (const k of aktiveKinder(state)) {
    const a = alter(state, k);
    if (saisonende && a >= B.stufen.U18.alterMax) continue; // geht ohnehin zu den Aktiven
    const stufe = k.teamId ? state.teams[k.teamId]?.stufe : stufeFuerAlter(a);
    const bf = stufe ? beitragsFaktor(state, stufe) : 1;
    let mult = Math.max(0.3, 1 + A.beitragElastizitaet * (bf - 1));
    const familie = state.familien[k.familieId];
    if (familie?.einkommen === 'tief') {
      mult *= haertefallAktiv(state, familie) ? 1 + (A.tiefesEinkommenFaktor - 1) * (1 - A.haertefallReduktion) : A.tiefesEinkommenFaktor;
    }
    let p: number;
    if (saisonende) {
      const z = k.zufriedenheit;
      p = z < 40 ? A.saisonende.unter40 : z < 55 ? A.saisonende.unter55 : z < 70 ? A.saisonende.unter70 : A.saisonende.sonst;
    } else {
      p = A.basisProWoche;
      if (k.zufriedenheit < A.schwelle) p += A.unterSchwelleMax * Math.pow((A.schwelle - k.zufriedenheit) / A.schwelle, 2) * 4;
    }
    if (k.werte.motivation < A.motivationSchwelle) p += A.motivationZusatz;
    p = p * mult + k.austrittsRisikoZusatz;
    k.austrittsRisikoZusatz = 0;
    if (rng.chance(clamp(p, 0, 0.95))) {
      const grund = saisonende
        ? 'Austritt zum Saisonende'
        : k.zufriedenheit < A.schwelle
          ? 'unzufrieden'
          : k.werte.motivation < A.motivationSchwelle
            ? 'keine Motivation mehr'
            : 'Familie hat andere Pläne';
      k.status = 'ausgetreten';
      k.austritt = { saison: state.saison, woche: state.woche, grund };
      k.teamId = null;
      state.saisonStatistik.austritte++;
      report.austritte.push({ id: k.id, name: name(k), grund });
    }
  }

  // 12. Neue Schnupperkinder: Mund-zu-Mund und spontane Anfragen
  if (!saisonende) {
    for (const k of aktiveKinder(state)) {
      if (k.zufriedenheit > B.eintritt.mundZuMundSchwelle && rng.chance(B.eintritt.mundZuMundProKind * eintrittsFaktor)) {
        const a = clamp(alter(state, k) + rng.int(-1, 1), 6, 17);
        const neu = neuesSchnupperkind(state, rng, a);
        if (neu) {
          ectx.schnupper.push(neu);
          neu.beziehungen.push({ zielId: k.id, art: 'freundschaft', staerke: 50 });
          k.beziehungen.push({ zielId: neu.id, art: 'freundschaft', staerke: 50 });
          report.meldungen.push(`${k.vorname} bringt ${neu.vorname} zum Schnuppern mit.`);
        }
      }
    }
    if (rng.chance(B.eintritt.spontanProWoche * eintrittsFaktor)) {
      const neu = neuesSchnupperkind(state, rng, rng.int(6, 12));
      if (neu) ectx.schnupper.push(neu);
    }
    // Nach den Sommerferien melden sich besonders viele Jüngere zum Schnuppern
    if (info.phase === 'trainingsstart' && rng.chance(Math.min(0.95, B.eintritt.spontanTrainingsstart * eintrittsFaktor))) {
      const [amin, amax] = B.eintritt.spontanTrainingsstartAlter as [number, number];
      const neu = neuesSchnupperkind(state, rng, rng.int(amin, amax));
      if (neu) ectx.schnupper.push(neu);
    }
  }
  for (const k of ectx.schnupper) report.schnupper.push({ id: k.id, name: name(k) });

  // 13. Wöchentliche Buchungen
  const F = B.finanzen;
  zahlungen(state, rng, report.buchungen);
  buchen(state, { kategorie: 'material', text: 'Material und Bälle', betrag: -F.material[state.finanzen.material] }, report.buchungen);
  const trainerMitTeam = aktiveTrainer(state).filter((t) => teamsVonTrainer(state, t.id).length > 0).length;
  buchen(
    state,
    {
      kategorie: 'trainerentschaedigung',
      text: `Spesen ${trainerMitTeam} Trainer:innen`,
      betrag: -trainerMitTeam * F.entschaedigungProTrainer[state.finanzen.entschaedigung]
    },
    report.buchungen
  );
  anlaesseWoche(state, rng, report.buchungen, report.meldungen);
  if (state.finanzen.kasse < 0) {
    state.finanzen.wochenUnterNull += 1;
    if (state.finanzen.wochenUnterNull === F.warnungNachWochen) report.meldungen.push('Warnung: Die Kasse ist seit zwei Wochen im Minus.');
  } else {
    state.finanzen.wochenUnterNull = 0;
  }

  // 13b. Vorstand, Social Media, Sponsoren, Vereinsprüfung
  socialWoche(state);
  sponsorenWoche(state);
  sitzung(state, rng, report.buchungen, report.meldungen);
  generalversammlung(state, report.meldungen);
  vereinsPruefung(state, report.meldungen, (vorlageId) => {
    erstelleInstanz(state, ereignisVorlage(vorlageId), {}, {});
  });

  // 14. Abschluss der Woche
  report.mitgliederNachher = aktiveKinder(state).length;
  report.zufriedenheitNachher = round1(durchschnittZufriedenheit(state));
  report.kasseNachher = state.finanzen.kasse;
  state.trainingsAnpassungen = {};
  state.zusammenlegungen = {};

  if (state.spielende) {
    // vorzeitiges Spielende (Absetzung, Konkurs, Auflösung): Bewertung festhalten
    const eb = endbewertung(state);
    state.spielende.endbewertung = eb;
    state.spielende.punkte = eb.punkte;
    state.spielende.titel = eb.titel;
  } else if (saisonende) {
    report.saisonBilanz = saisonAbschliessen(state, rng);
  } else {
    state.woche += 1;
  }

  // Aufräumen: alte, erledigte Ereignisse und gelesene Nachrichten begrenzen
  const jetzt = absoluteWoche(state);
  state.ereignisse = state.ereignisse.filter((e) => !e.erledigt || e.ablaufWoche > jetzt - 12);
  if (state.posteingang.length > 250) {
    const ueberzaehlig = state.posteingang.length - 250;
    let entfernt = 0;
    state.posteingang = state.posteingang.filter((n) => {
      if (entfernt < ueberzaehlig && n.gelesen && !n.ereignisId) {
        entfernt++;
        return false;
      }
      return true;
    });
  }

  // 15. Neue Ereignisse für die kommende Woche
  const events = state.spielende ? [] : erzeugeEreignisse(state, rng, ereignisKontext(state));

  state.rngState = rng.state;
  return { state, events, report };
}

/** Standardoption der Vorlage, falls verfügbar, sonst die erste verfügbare */
function standardOption(vorlageId: string, verfuegbar: string[]): string {
  const v = ereignisVorlage(vorlageId);
  return verfuegbar.includes(v.standardOption) ? v.standardOption : verfuegbar[0]!;
}
