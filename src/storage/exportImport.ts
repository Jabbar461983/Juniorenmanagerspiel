// JSON-Export und -Import von Spielständen (unabhängig vom Speicherort).
import { migriere, SpielstandFehler, type Entscheid } from '../engine';
import type { Spielstand } from './SaveRepository';

export const EXPORT_FORMAT = 'juniorenmanager-spielstand';
export const EXPORT_VERSION = 1;

export function exportiereJson(stand: Spielstand): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, ...stand });
}

export function importiereJson(text: string): Spielstand {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new SpielstandFehler('Die Datei ist kein gültiges JSON.');
  }
  if (typeof roh !== 'object' || roh === null || (roh as Record<string, unknown>)['format'] !== EXPORT_FORMAT) {
    throw new SpielstandFehler('Die Datei ist kein Juniorenmanager-Spielstand.');
  }
  const obj = roh as Record<string, unknown>;
  const state = migriere(obj['state']);
  const metaRoh = (obj['meta'] ?? {}) as Record<string, unknown>;
  const entwurf = Array.isArray(obj['entwurf']) ? (obj['entwurf'] as Entscheid[]) : [];
  return {
    meta: {
      id: typeof metaRoh['id'] === 'string' ? metaRoh['id'] : 'import',
      name: typeof metaRoh['name'] === 'string' ? metaRoh['name'] : state.verein.name,
      vereinsname: state.verein.name,
      saison: state.saison,
      woche: state.woche,
      gespeichertAm: typeof metaRoh['gespeichertAm'] === 'string' ? metaRoh['gespeichertAm'] : new Date().toISOString(),
      autosave: false
    },
    state,
    entwurf
  };
}
