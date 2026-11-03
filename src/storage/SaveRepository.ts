// Speicher-Schnittstelle. Der Spielkern kennt keine Speicherung; die Oberfläche
// spricht nur mit diesem Interface. Eine Supabase-Umsetzung (Etappe 5) muss nur
// dieses Interface erfüllen.
import type { Entscheid, GameState } from '../engine';

export interface SpeicherMeta {
  id: string;
  /** frei wählbarer Name des Speicherplatzes */
  name: string;
  vereinsname: string;
  saison: number;
  woche: number;
  /** ISO-Zeitstempel */
  gespeichertAm: string;
  autosave: boolean;
}

export interface Spielstand {
  meta: SpeicherMeta;
  state: GameState;
  /** noch nicht simulierte Entscheide der laufenden Woche */
  entwurf: Entscheid[];
}

export interface SaveRepository {
  liste(): Promise<SpeicherMeta[]>;
  laden(id: string): Promise<Spielstand | null>;
  speichern(stand: Spielstand): Promise<void>;
  loeschen(id: string): Promise<void>;
}

export function metaFuer(state: GameState, id: string, name: string, autosave: boolean, jetzt = new Date()): SpeicherMeta {
  return {
    id,
    name,
    vereinsname: state.verein.name,
    saison: state.saison,
    woche: state.woche,
    gespeichertAm: jetzt.toISOString(),
    autosave
  };
}
