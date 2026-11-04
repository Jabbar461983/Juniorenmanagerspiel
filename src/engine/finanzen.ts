// Beiträge und Buchungen.
import { B } from './config';
import { stufeFuerAlter, alter } from './personen';
import type { Buchung, Familie, GameState, Kind, Stufe } from './types';

export function haertefallAktiv(state: GameState, familie: Familie): boolean {
  return familie.haertefall || (state.finanzen.haertefallfonds && familie.einkommen === 'tief');
}

/** Stufe eines Kindes: über das Team, sonst über den Jahrgang. */
export function stufeVonKind(state: GameState, k: Kind): Stufe | null {
  if (k.teamId && state.teams[k.teamId]) return state.teams[k.teamId]!.stufe;
  return stufeFuerAlter(alter(state, k));
}

/** Ist das Kind ein jüngeres Geschwister eines anderen aktiven Kindes (für Rabatt)? */
export function istGeschwisterMitRabatt(state: GameState, k: Kind): boolean {
  const familie = state.familien[k.familieId];
  if (!familie) return false;
  const aktive = familie.kinderIds
    .map((id) => state.kinder[id])
    .filter((x): x is Kind => !!x && x.status === 'aktiv');
  if (aktive.length < 2) return false;
  // Das älteste Kind zahlt voll
  const aeltestes = aktive.reduce((a, b) => (b.geburtsjahr < a.geburtsjahr ? b : a));
  return aeltestes.id !== k.id;
}

/** Effektiver Jahresbeitrag eines Kindes in CHF */
export function jahresbeitrag(state: GameState, k: Kind): number {
  const stufe = stufeVonKind(state, k);
  if (!stufe) return 0;
  let betrag = state.finanzen.beitraege[stufe];
  if (istGeschwisterMitRabatt(state, k)) betrag *= 1 - state.finanzen.geschwisterrabatt / 100;
  const familie = state.familien[k.familieId];
  if (familie && haertefallAktiv(state, familie)) betrag *= 1 - B.finanzen.haertefallRabatt;
  return betrag;
}

/** Verhältnis Beitrag zu Referenzbeitrag der Stufe (1 = marktüblich) */
export function beitragsFaktor(state: GameState, stufe: Stufe): number {
  const ref = B.finanzen.beitraegeReferenz[stufe];
  return ref > 0 ? state.finanzen.beitraege[stufe] / ref : 1;
}

/** Durchschnittlicher Beitragsfaktor über alle Stufen */
export function beitragsFaktorSchnitt(state: GameState): number {
  const stufen: Stufe[] = ['U9', 'U12', 'U15', 'U18'];
  return stufen.reduce((s, st) => s + beitragsFaktor(state, st), 0) / stufen.length;
}

export function buchen(state: GameState, b: Omit<Buchung, 'saison' | 'woche'>, liste: Buchung[]): void {
  if (Math.abs(b.betrag) < 0.005) return;
  const buchung: Buchung = { saison: state.saison, woche: state.woche, ...b, betrag: Math.round(b.betrag * 100) / 100 };
  state.finanzen.kasse = Math.round((state.finanzen.kasse + buchung.betrag) * 100) / 100;
  state.finanzen.buchungen.push(buchung);
  liste.push(buchung);
}

export const KATEGORIE_NAMEN: Record<Buchung['kategorie'], string> = {
  beitraege: 'Mitgliederbeiträge',
  hallenmiete: 'Hallenmiete',
  material: 'Material',
  trainerentschaedigung: 'Trainerentschädigung',
  anwerbung: 'Anwerbung',
  verbandsgebuehren: 'Verbandsgebühren',
  vereinsbeitrag: 'Beitrag Gesamtverein',
  ereignis: 'Ereignisse',
  elternarbeit: 'Elternarbeit'
};
