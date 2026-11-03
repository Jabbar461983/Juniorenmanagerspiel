// Hilfsfunktionen rund um Personen, Teams und Stufen (reine Lesezugriffe).
import { B } from './config';
import { saisonJahr } from './kalender';
import type {
  GameState,
  Id,
  Kind,
  PersonBasis,
  PortraitGruppe,
  Stimmung,
  Stufe,
  Team,
  Trainer
} from './types';
import { STUFEN } from './types';

export function alter(state: Pick<GameState, 'startJahr' | 'saison'>, p: Pick<PersonBasis, 'geburtsjahr'>): number {
  return saisonJahr(state) - p.geburtsjahr;
}

export function stufeFuerAlter(a: number): Stufe | null {
  for (const s of STUFEN) {
    const c = B.stufen[s];
    if (a >= c.alterMin && a <= c.alterMax) return s;
  }
  return null;
}

export function portraitGruppe(a: number): PortraitGruppe {
  if (a <= 11) return 'kind';
  if (a <= 17) return 'jugend';
  if (a <= 30) return 'jung';
  if (a <= 55) return 'erwachsen';
  return 'aelter';
}

export function stimmungAus(zufriedenheit: number): Stimmung {
  if (zufriedenheit > 66) return 'froh';
  if (zufriedenheit >= 34) return 'neutral';
  return 'bedrueckt';
}

export function name(p: Pick<PersonBasis, 'vorname' | 'nachname'>): string {
  return `${p.vorname} ${p.nachname}`;
}

export function aktiveKinder(state: GameState): Kind[] {
  return Object.values(state.kinder).filter((k) => k.status === 'aktiv');
}

/** aktive und schnuppernde Kinder */
export function kinderImVerein(state: GameState): Kind[] {
  return Object.values(state.kinder).filter((k) => k.status !== 'ausgetreten');
}

export function teamKinder(state: GameState, teamId: Id, inklSchnupper = true): Kind[] {
  return Object.values(state.kinder).filter(
    (k) => k.teamId === teamId && (k.status === 'aktiv' || (inklSchnupper && k.status === 'schnupper'))
  );
}

export function teamTrainer(state: GameState, team: Team): Trainer[] {
  return team.trainer
    .map((t) => state.trainer[t.trainerId])
    .filter((t): t is Trainer => !!t && t.status === 'aktiv');
}

export function aktiveTrainer(state: GameState): Trainer[] {
  return Object.values(state.trainer).filter((t) => t.status === 'aktiv');
}

export function teamsVonTrainer(state: GameState, trainerId: Id): Team[] {
  return Object.values(state.teams).filter((t) => t.trainer.some((tt) => tt.trainerId === trainerId));
}

export function teamsDerStufe(state: GameState, stufe: Stufe): Team[] {
  return Object.values(state.teams).filter((t) => t.stufe === stufe);
}

export function durchschnittZufriedenheit(state: GameState): number {
  const kinder = aktiveKinder(state);
  if (kinder.length === 0) return 0;
  return kinder.reduce((s, k) => s + k.zufriedenheit, 0) / kinder.length;
}

export function spielstaerkeKind(k: Kind): number {
  return (k.werte.technik + k.werte.kondition + k.werte.spielverstaendnis) / 3;
}

/** Team mit den wenigsten Kindern der passenden Stufe (für Neueintritte). */
export function passendesTeam(state: GameState, stufe: Stufe): Team | null {
  const teams = teamsDerStufe(state, stufe);
  if (teams.length === 0) return null;
  return teams.reduce((best, t) =>
    teamKinder(state, t.id).length < teamKinder(state, best.id).length ? t : best
  );
}

/**
 * Talent-Einschätzung: verborgen, ausser ein Trainer im Team hat viel Erfahrung
 * (Erfahrung ≥ 14) – dann wird eine grobe Einschätzung angezeigt.
 */
export function talentEinschaetzung(state: GameState, k: Kind): string | null {
  if (!k.teamId) return null;
  const team = state.teams[k.teamId];
  if (!team) return null;
  const erfahren = teamTrainer(state, team).some((t) => t.skills.erfahrung >= 14);
  if (!erfahren) return null;
  if (k.werte.talent >= 15) return 'gross';
  if (k.werte.talent >= 9) return 'mittel';
  return 'klein';
}
