import type { GameState, Id } from './types';

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Vergibt eine neue, im Spielstand eindeutige Id. */
export function neueId(state: GameState, praefix: string): Id {
  const id = `${praefix}${state.naechsteId}`;
  state.naechsteId += 1;
  return id;
}

/** Tiefe Kopie eines JSON-serialisierbaren Spielstands. */
export function klonen<T>(wert: T): T {
  return JSON.parse(JSON.stringify(wert)) as T;
}

export function chf(betrag: number): string {
  const gerundet = Math.round(betrag);
  const abs = Math.abs(gerundet)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `CHF ${gerundet < 0 ? '−' : ''}${abs}`;
}
