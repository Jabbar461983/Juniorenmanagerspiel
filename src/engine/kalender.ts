// Saisonkalender: Juni bis Mai, 52 Wochenrunden. Alle Datumsrechnungen in UTC,
// damit das Ergebnis unabhängig von der Zeitzone ist.
import { B, FERIEN, type FerienDef } from './config';
import type { GameState, Phase } from './types';

const TAG_MS = 24 * 60 * 60 * 1000;

export interface WochenInfo {
  woche: number;
  /** Montag der Woche, ISO-Datum (YYYY-MM-DD) */
  montag: string;
  phase: Phase;
  ferien: FerienDef | null;
  monat: number;
}

export function saisonJahr(state: Pick<GameState, 'startJahr' | 'saison'>): number {
  return state.startJahr + state.saison - 1;
}

/** Montag der ersten Saisonwoche: der Montag, der dem 1. Juni am nächsten liegt. */
export function saisonStart(jahr: number): number {
  const juni1 = Date.UTC(jahr, 5, 1);
  const wochentag = new Date(juni1).getUTCDay(); // 0 = Sonntag
  const bisMontag = (wochentag + 6) % 7; // Tage seit dem letzten Montag
  const offset = bisMontag <= 3 ? -bisMontag : 7 - bisMontag;
  return juni1 + offset * TAG_MS;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function ferienIntervall(f: FerienDef, jahr: number): [number, number] {
  const teil = (s: string): [number, number] => {
    const [m, d] = s.split('-').map(Number) as [number, number];
    return [m, d];
  };
  const [vm, vd] = teil(f.von);
  const [bm, bd] = teil(f.bis);
  const vonJahr = vm >= 6 ? jahr : jahr + 1;
  const bisJahr = bm >= vm ? vonJahr : vonJahr + 1;
  return [Date.UTC(vonJahr, vm - 1, vd), Date.UTC(bisJahr, bm - 1, bd)];
}

export function phaseFuer(monat: number, tag: number): Phase {
  if (monat === 6 || monat === 7) return 'vorbereitung';
  if (monat === 8 || (monat === 9 && tag < 15)) return 'trainingsstart';
  if (monat >= 9 || monat <= 2) return 'meisterschaft';
  if (monat === 3 || monat === 4) return 'playoffs';
  return 'abschluss';
}

export function wochenInfo(jahr: number, woche: number): WochenInfo {
  const montag = saisonStart(jahr) + (woche - 1) * 7 * TAG_MS;
  const mittwoch = montag + 2 * TAG_MS;
  const d = new Date(mittwoch);
  const monat = d.getUTCMonth() + 1;
  // Ab Woche 49 ist bereits Mai (Abschluss), auch wenn der Kalender etwas schiebt.
  const phase = woche >= B.spiel.wochenProSaison - 3 ? 'abschluss' : phaseFuer(monat, d.getUTCDate());
  let ferien: FerienDef | null = null;
  for (const f of FERIEN) {
    const [von, bis] = ferienIntervall(f, jahr);
    if (mittwoch >= von && mittwoch <= bis + TAG_MS - 1) {
      ferien = f;
      break;
    }
  }
  return { woche, montag: iso(montag), phase, ferien, monat };
}

export function saisonKalender(jahr: number): WochenInfo[] {
  const wochen: WochenInfo[] = [];
  for (let w = 1; w <= B.spiel.wochenProSaison; w++) wochen.push(wochenInfo(jahr, w));
  return wochen;
}

export function aktuelleWoche(state: GameState): WochenInfo {
  return wochenInfo(saisonJahr(state), Math.min(state.woche, B.spiel.wochenProSaison));
}

const MONATE = ['Jan.', 'Feb.', 'März', 'April', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

export function datumText(isoDatum: string): string {
  const [j, m, d] = isoDatum.split('-').map(Number) as [number, number, number];
  return `${d}. ${MONATE[m - 1]} ${j}`;
}

export const PHASEN_NAMEN: Record<Phase, string> = {
  vorbereitung: 'Vorbereitung',
  trainingsstart: 'Trainingsstart',
  meisterschaft: 'Meisterschaft',
  playoffs: 'Playoffs U18',
  abschluss: 'Finalturniere und Abschluss'
};

/** Fortlaufende Woche über alle Saisons (1-basiert) */
export function absoluteWoche(state: Pick<GameState, 'saison' | 'woche'>): number {
  return (state.saison - 1) * B.spiel.wochenProSaison + state.woche;
}
