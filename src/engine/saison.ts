// Saisonende: Bilanz, Übertritte, U18-Abgänge, Trainerentwicklung, Spielende.
import { B } from './config';
import { alter, aktiveKinder, kinderImVerein, name, passendesTeam, portraitGruppe, stufeFuerAlter, teamTrainer, teamsVonTrainer } from './personen';
import type { Rng } from './rng';
import type { GameState, SaisonBilanz } from './types';
import { STUFEN } from './types';
import { leererWettkampf, tabelle, playoffRundeName } from './wettkampf';
import { clamp, neueId } from './util';

/** Punkte: Anzahl × Zufriedenheit; Zufriedenheit zählt überproportional. */
export function bewertung(zufriedenheiten: number[]): number {
  const { exponent, faktor } = B.bewertung;
  return Math.round(zufriedenheiten.reduce((s, z) => s + faktor * Math.pow(clamp(z, 0, 100) / 100, exponent), 0));
}

export function bewertungsTitel(punkte: number): string {
  for (const t of B.bewertung.titel) if (punkte >= t.ab) return t.titel;
  return B.bewertung.titel[B.bewertung.titel.length - 1]!.titel;
}

export function wettkampfZusammenfassung(state: GameState): string[] {
  const wk = state.wettkampf;
  const res: string[] = [];
  if (!wk.gestartet) return res;
  for (const stufe of ['U12', 'U15'] as const) {
    const liga = wk.ligen[stufe];
    const tab = tabelle(liga.teams, liga.spiele.filter((s) => s.typ === 'liga'));
    for (const t of liga.teams.filter((x) => x.eigenesTeamId)) {
      const rang = tab.findIndex((z) => z.id === t.id) + 1;
      const final = liga.finalRangliste.indexOf(t.id);
      res.push(
        `${t.name}: Liga Rang ${rang}` + (final >= 0 ? `, Finalturnier Rang ${final + 1}` : ', nicht fürs Finalturnier qualifiziert')
      );
    }
  }
  const m = wk.u18;
  const tab = tabelle(m.teams, m.spiele.filter((s) => s.typ === 'meisterschaft'));
  for (const t of m.teams.filter((x) => x.eigenesTeamId)) {
    const rang = tab.findIndex((z) => z.id === t.id) + 1;
    let text = `${t.name}: Qualifikation Rang ${rang}`;
    if (m.meisterId === t.id) text += ', Meister!';
    else {
      const serien = m.playoffs.filter((s) => s.hoehergesetztId === t.id || s.tiefergesetztId === t.id);
      const letzte = serien[serien.length - 1];
      if (letzte) text += `, ausgeschieden im ${playoffRundeName(letzte.runde)}`;
      else text += ', Playoffs verpasst';
    }
    res.push(text);
  }
  const u9 = wk.u9.teilnehmer.filter((t) => t.eigenesTeamId);
  if (u9.length > 0) res.push(`U9: ${wk.u9.turnierWochen.length} Turniere ohne Rangliste – Hauptsache Spass.`);
  return res;
}

/** Schliesst die Saison ab (nach Woche 52). Mutiert den Spielstand. */
export function saisonAbschliessen(state: GameState, rng: Rng): SaisonBilanz {
  const kinder = aktiveKinder(state);
  const zs = kinder.map((k) => k.zufriedenheit);
  const punkte = bewertung(zs);
  const bilanz: SaisonBilanz = {
    saison: state.saison,
    mitgliederStart: state.saisonStatistik.mitgliederStart,
    mitgliederEnde: kinder.length,
    zufriedenheitSchnitt: zs.length ? Math.round((zs.reduce((a, b) => a + b, 0) / zs.length) * 10) / 10 : 0,
    eintritte: state.saisonStatistik.eintritte,
    austritte: state.saisonStatistik.austritte,
    u18Abgaenger: 0,
    uebertritte: 0,
    kasseEnde: state.finanzen.kasse,
    bewertung: punkte,
    titel: bewertungsTitel(punkte),
    wettkampf: wettkampfZusammenfassung(state)
  };

  // ---- Übergang in die neue Saison ----
  state.saison += 1;
  state.woche = 1;

  for (const k of kinderImVerein(state)) {
    const a = alter(state, k);
    k.portrait.gruppe = portraitGruppe(a);
    const stufe = stufeFuerAlter(a);
    if (!stufe) {
      k.status = 'ausgetreten';
      k.austritt = { saison: state.saison - 1, woche: B.spiel.wochenProSaison, grund: 'U18-Abgang: Übertritt zu den Aktiven' };
      k.teamId = null;
      bilanz.u18Abgaenger++;
      continue;
    }
    const aktuell = k.teamId ? state.teams[k.teamId] : undefined;
    if (!aktuell || aktuell.stufe !== stufe) {
      const ziel = passendesTeam(state, stufe);
      k.teamId = ziel?.id ?? null;
      if (aktuell) bilanz.uebertritte++;
    }
  }
  for (const e of Object.values(state.eltern)) e.portrait.gruppe = portraitGruppe(alter(state, e));

  const ruecktritte: string[] = [];
  for (const t of Object.values(state.trainer)) {
    if (t.status !== 'aktiv') continue;
    const a = alter(state, t);
    t.portrait.gruppe = portraitGruppe(a);
    t.skills.erfahrung = clamp(t.skills.erfahrung + B.trainer.erfahrungProSaison, 1, 20);
    t.skills.fachwissen = clamp(Math.round((t.skills.fachwissen + B.trainer.fachwissenProSaison) * 10) / 10, 1, 20);
    t.absagenSaison = 0;
    let p = B.trainer.ruecktrittSaisonende;
    if (t.motivation < 8) p += B.trainer.ruecktrittTiefeMotivation;
    if (a > 65) p += 0.1;
    if (teamsVonTrainer(state, t.id).length === 0) p += 0.15;
    if (rng.chance(p)) {
      t.status = 'zurueckgetreten';
      for (const team of teamsVonTrainer(state, t.id)) team.trainer = team.trainer.filter((x) => x.trainerId !== t.id);
      ruecktritte.push(name(t));
    } else {
      t.belastung = clamp(t.belastung - 30, 0, 100);
    }
  }
  for (const team of Object.values(state.teams)) {
    team.absagenSaison = 0;
    team.absagenInFolge = 0;
    team.elternabende = 0;
  }

  state.wettkampf = leererWettkampf();
  state.bilanzen.push(bilanz);
  state.saisonStatistik = { mitgliederStart: aktiveKinder(state).length, eintritte: 0, austritte: 0 };

  const ohneTeam = STUFEN.filter((s) => !Object.values(state.teams).some((t) => t.stufe === s));
  state.posteingang.push({
    id: neueId(state, 'n'),
    saison: state.saison,
    woche: 1,
    absender: 'Sportchef:in',
    titel: `Saisonbilanz ${bilanz.saison}`,
    text:
      `Saison ${bilanz.saison} abgeschlossen: ${bilanz.mitgliederEnde} aktive Junior:innen, ` +
      `Zufriedenheit ${bilanz.zufriedenheitSchnitt}. ${bilanz.u18Abgaenger} U18-Abgänger:innen wechseln zu den Aktiven, ` +
      `${bilanz.uebertritte} Übertritte in die nächste Stufe.` +
      (ruecktritte.length ? ` Rücktritte: ${ruecktritte.join(', ')}.` : '') +
      (ohneTeam.length ? ` Achtung: keine Teams in ${ohneTeam.join(', ')}.` : ''),
    gelesen: false,
    wichtig: true
  });

  // Teams ohne Trainer melden
  for (const team of Object.values(state.teams)) {
    if (teamTrainer(state, team).length === 0) {
      state.posteingang.push({
        id: neueId(state, 'n'),
        saison: state.saison,
        woche: 1,
        absender: 'System',
        titel: `${team.name} ohne Trainer:in`,
        text: `${team.name} hat für die neue Saison niemanden im Trainerteam. Teile jemanden zu.`,
        gelesen: false,
        wichtig: true
      });
    }
  }

  // Spielende
  const gespielt = state.saison - 1;
  if (gespielt >= state.laufzeit || gespielt >= B.spiel.etappeMaxSaisons) {
    const grund = gespielt >= state.laufzeit ? 'laufzeit' : 'etappenEnde';
    state.spielende = {
      grund,
      punkte: bilanz.bewertung,
      titel: bilanz.titel,
      text:
        grund === 'laufzeit'
          ? `Deine Amtszeit ist vorbei. Endbewertung: ${bilanz.bewertung} Punkte – «${bilanz.titel}».`
          : `Ende der spielbaren Version (Etappe 1). Vorläufige Bewertung nach ${gespielt} Saison: ${bilanz.bewertung} Punkte – «${bilanz.titel}». Die weiteren Saisons folgen in den nächsten Etappen.`
    };
  }
  return bilanz;
}
