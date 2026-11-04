// Neues Spiel: Startsituation mit einer kleinen bestehenden Abteilung.
import { B, HALLEN } from './config';
import { neuesTeam } from './entscheide';
import { ereignisKontext, erzeugeEreignisse } from './ereignisse';
import { erzeugeFamilie, erzeugeKind, erzeugeTrainer } from './generator';
import { familieVernetzen } from './eltern';
import { erzeugeVorstand, leererVorstand } from './vorstand';
import { SCHEMA_VERSION } from './migrations';
import { aktiveKinder, stufeFuerAlter, teamKinder } from './personen';
import { Rng, seedAus } from './rng';
import { leererWettkampf } from './wettkampf';
import type { GameState, Stufe, TrainerRolle } from './types';
import { STUFEN } from './types';
import { teamKontext, zielFaktoren } from './zufriedenheit';

export interface NeuesSpielOptionen {
  vereinsname: string;
  laufzeit?: number;
  startbudget?: number;
  seed?: number;
  /** Kalenderjahr, in dem die erste Saison im Juni beginnt */
  startJahr?: number;
  /** Lernmodus: kein vorzeitiges Spielende (Etappe 3) */
  lernmodus?: boolean;
}

export function neuesSpiel(opt: NeuesSpielOptionen): GameState {
  const seed = opt.seed ?? seedAus(Date.now());
  const rng = new Rng(seed);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: seed,
    verein: { name: opt.vereinsname.trim() || 'SHC Junioren', ruf: 50, vorstandEinfluss: 50 },
    saison: 1,
    startJahr: opt.startJahr ?? 2026,
    woche: 1,
    laufzeit: Math.max(1, Math.round(opt.laufzeit ?? B.spiel.laufzeitStandard)),
    kinder: {},
    eltern: {},
    trainer: {},
    familien: {},
    teams: {},
    finanzen: {
      kasse: opt.startbudget ?? B.spiel.startbudgetStandard,
      beitraege: { ...B.finanzen.beitraegeStandard },
      geschwisterrabatt: B.finanzen.geschwisterrabattStandard,
      haertefallfonds: false,
      material: 'mittel',
      entschaedigung: 'mittel',
      buchungen: [],
      wochenUnterNull: 0
    },
    wettkampf: leererWettkampf(),
    ereignisse: [],
    posteingang: [],
    trainingsAnpassungen: {},
    zusammenlegungen: {},
    ereignisVerlauf: {},
    bilanzen: [],
    saisonStatistik: { mitgliederStart: 0, eintritte: 0, austritte: 0 },
    naechsteId: 1,
    erweiterungen: {},
    vorstand: leererVorstand(),
    social: { reichweite: B.social.reichweiteStart, posts: [] },
    sponsoren: [],
    aktivitaeten: [],
    chronik: [],
    lernmodus: !!opt.lernmodus,
    sponsorSucheBis: 0
  };
  state.verein.vorstandEinfluss = B.vorstand.einfluss.start;

  // Teams, eines pro Stufe
  STUFEN.forEach((stufe, i) => neuesTeam(state, stufe, stufe, HALLEN[i % HALLEN.length]));

  // Kinder in Familien, Geschwister möglich
  for (const stufe of STUFEN) {
    const c = B.stufen[stufe];
    const ziel = rng.int(c.startKinder[0]!, c.startKinder[1]!);
    while (Object.values(state.kinder).filter((k) => stufeFuerAlter(saisonAlter(state, k.geburtsjahr)) === stufe).length < ziel) {
      const familie = erzeugeFamilie(state, rng);
      erzeugeKind(state, rng, familie, { alter: rng.int(c.alterMin, c.alterMax) });
      if (rng.chance(B.start.geschwisterWahrscheinlichkeit)) {
        erzeugeKind(state, rng, familie, { alter: rng.int(6, 17) });
      }
    }
  }
  for (const k of Object.values(state.kinder)) {
    const stufe = stufeFuerAlter(saisonAlter(state, k.geburtsjahr)) as Stufe;
    k.teamId = Object.values(state.teams).find((t) => t.stufe === stufe)!.id;
  }

  // Familien im selben Team kennen sich teilweise
  for (const team of Object.values(state.teams)) {
    const familien = [...new Set(teamKinder(state, team.id).map((k) => k.familieId))];
    for (const fid of familien) familieVernetzen(state, rng, fid, team.id);
  }

  // Trainer:innen pro Team
  const rollenFolge: TrainerRolle[] = ['haupttrainer', 'cotrainer', 'betreuer', 'torhuetertrainer'];
  for (const team of Object.values(state.teams)) {
    const anzahl = rng.int(B.start.trainerProTeam[0]!, B.start.trainerProTeam[1]!);
    for (let i = 0; i < anzahl; i++) {
      // In der U18 hilft oft ein:e junge:r Hilfsleiter:in
      const t = erzeugeTrainer(state, rng, i === 2 && team.stufe !== 'U9' ? { alter: rng.int(16, 22) } : {});
      team.trainer.push({ trainerId: t.id, rolle: rollenFolge[i]! });
    }
  }
  for (let i = 0; i < B.start.reserveTrainer; i++) erzeugeTrainer(state, rng);

  erzeugeVorstand(state, rng);
  state.vorstand.einflussVerlauf.push({ saison: 1, woche: 1, wert: state.verein.vorstandEinfluss });

  // Anfangsfaktoren berechnen (nur zur Anzeige)
  for (const team of Object.values(state.teams)) {
    const ctx = teamKontext(state, team);
    for (const k of teamKinder(state, team.id)) k.faktoren = zielFaktoren(state, k, ctx);
  }
  state.saisonStatistik.mitgliederStart = aktiveKinder(state).length;

  state.posteingang.push({
    id: `n${state.naechsteId++}`,
    saison: 1,
    woche: 1,
    absender: 'Präsident:in',
    titel: 'Willkommen als Juniorenverantwortliche:r!',
    text:
      `Schön, dass du die Junioren von ${state.verein.name} übernimmst. Du startest mit ${aktiveKinder(state).length} Kindern in vier Teams. ` +
      'Plane in der Vorbereitung Trainer, Trainings und Anwerbung. Mitgliederbeiträge kannst du nur jetzt, in der Vorbereitung, anpassen. ' +
      'Unser Ziel: möglichst viele und möglichst glückliche Junior:innen. Der Vorstand trifft sich alle vier Wochen – dort kannst du Anträge stellen.',
    gelesen: false,
    wichtig: true
  });

  erzeugeEreignisse(state, rng, ereignisKontext(state));
  state.rngState = rng.state;
  return state;
}

function saisonAlter(state: GameState, geburtsjahr: number): number {
  return state.startJahr + state.saison - 1 - geburtsjahr;
}
