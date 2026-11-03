// Lokale Speicherung in IndexedDB.
import { migriere } from '../engine';
import type { SaveRepository, SpeicherMeta, Spielstand } from './SaveRepository';

const DB_NAME = 'juniorenmanager';
const DB_VERSION = 1;
const STORE = 'spielstaende';

interface Datensatz extends Spielstand {
  id: string;
}

function anfrage<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDbRepository implements SaveRepository {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private oeffnen(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const req = this.factory.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.db;
  }

  private async store(modus: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.oeffnen();
    return db.transaction(STORE, modus).objectStore(STORE);
  }

  async liste(): Promise<SpeicherMeta[]> {
    const alle = await anfrage((await this.store('readonly')).getAll() as IDBRequest<Datensatz[]>);
    return alle.map((d) => d.meta).sort((a, b) => b.gespeichertAm.localeCompare(a.gespeichertAm));
  }

  async laden(id: string): Promise<Spielstand | null> {
    const d = await anfrage((await this.store('readonly')).get(id) as IDBRequest<Datensatz | undefined>);
    if (!d) return null;
    return { meta: d.meta, state: migriere(d.state), entwurf: d.entwurf ?? [] };
  }

  async speichern(stand: Spielstand): Promise<void> {
    const datensatz: Datensatz = { id: stand.meta.id, ...JSON.parse(JSON.stringify(stand)) };
    await anfrage((await this.store('readwrite')).put(datensatz));
  }

  async loeschen(id: string): Promise<void> {
    await anfrage((await this.store('readwrite')).delete(id));
  }
}

/** Fallback ohne Persistenz (z.B. wenn IndexedDB blockiert ist) und für Tests. */
export class MemoryRepository implements SaveRepository {
  private daten = new Map<string, string>();

  async liste(): Promise<SpeicherMeta[]> {
    return [...this.daten.values()]
      .map((t) => (JSON.parse(t) as Spielstand).meta)
      .sort((a, b) => b.gespeichertAm.localeCompare(a.gespeichertAm));
  }
  async laden(id: string): Promise<Spielstand | null> {
    const t = this.daten.get(id);
    if (!t) return null;
    const s = JSON.parse(t) as Spielstand;
    return { ...s, state: migriere(s.state) };
  }
  async speichern(stand: Spielstand): Promise<void> {
    this.daten.set(stand.meta.id, JSON.stringify(stand));
  }
  async loeschen(id: string): Promise<void> {
    this.daten.delete(id);
  }
}

export function erstelleRepository(): SaveRepository {
  try {
    if (typeof indexedDB !== 'undefined') return new IndexedDbRepository();
  } catch {
    // ignorieren, Fallback unten
  }
  return new MemoryRepository();
}
