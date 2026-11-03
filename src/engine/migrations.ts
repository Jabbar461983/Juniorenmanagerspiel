// Schema-Version und Migrationen des Spielstands.
import type { GameState } from './types';

export const SCHEMA_VERSION = 1;

/**
 * Migrationen: Schlüssel = Ausgangsversion. Jede Funktion hebt einen Rohstand
 * um genau eine Version an. Beispiel für später:
 *   1: (raw) => ({ ...raw, schemaVersion: 2, vorstand: [] })
 */
const MIGRATIONEN: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export class SpielstandFehler extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'SpielstandFehler';
  }
}

export function migriere(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) throw new SpielstandFehler('Kein gültiger Spielstand.');
  let obj = raw as Record<string, unknown>;
  const roh = obj['schemaVersion'];
  if (typeof roh !== 'number') throw new SpielstandFehler('Spielstand ohne Schema-Version.');
  let version: number = roh;
  if (version > SCHEMA_VERSION) {
    throw new SpielstandFehler(`Der Spielstand stammt aus einer neueren Version (${version}). Bitte die App aktualisieren.`);
  }
  while (version < SCHEMA_VERSION) {
    const m = MIGRATIONEN[version];
    if (!m) throw new SpielstandFehler(`Keine Migration von Version ${version} vorhanden.`);
    obj = m(obj);
    version = obj['schemaVersion'] as number;
  }
  for (const feld of ['seed', 'rngState', 'verein', 'kinder', 'teams', 'finanzen', 'wettkampf']) {
    if (!(feld in obj)) throw new SpielstandFehler(`Spielstand unvollständig: ${feld} fehlt.`);
  }
  return obj as unknown as GameState;
}

/** Hilfsfunktion für Tests: registriert eine Migration */
export function _registriereMigration(von: number, fn: (raw: Record<string, unknown>) => Record<string, unknown>): void {
  MIGRATIONEN[von] = fn;
}
