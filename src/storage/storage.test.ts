import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { neuesSpiel } from '../engine';
import { IndexedDbRepository, MemoryRepository } from './IndexedDbRepository';
import { exportiereJson, importiereJson } from './exportImport';
import { metaFuer, type SaveRepository } from './SaveRepository';

function stand(id: string, datum: string) {
  const state = neuesSpiel({ vereinsname: 'SHC Speicher', seed: 1 });
  return { meta: metaFuer(state, id, `Platz ${id}`, false, new Date(datum)), state, entwurf: [] };
}

for (const [name, erzeuge] of [
  ['IndexedDB', () => new IndexedDbRepository(new IDBFactory())],
  ['Memory', () => new MemoryRepository()]
] as [string, () => SaveRepository][]) {
  describe(`${name}Repository`, () => {
    it('speichert, listet, lädt und löscht', async () => {
      const repo = erzeuge();
      await repo.speichern(stand('a', '2026-01-01T10:00:00Z'));
      await repo.speichern(stand('b', '2026-01-02T10:00:00Z'));
      const liste = await repo.liste();
      expect(liste.map((m) => m.id)).toEqual(['b', 'a']);
      const geladen = await repo.laden('a');
      expect(geladen?.state.verein.name).toBe('SHC Speicher');
      expect(geladen?.state).toEqual(stand('a', '2026-01-01T10:00:00Z').state);
      await repo.loeschen('a');
      expect(await repo.laden('a')).toBeNull();
      expect((await repo.liste()).length).toBe(1);
    });
  });
}

describe('JSON-Export und -Import', () => {
  it('ergibt nach dem Import denselben Spielstand', () => {
    const s = stand('x', '2026-02-02T10:00:00Z');
    const text = exportiereJson(s);
    const zurueck = importiereJson(text);
    expect(zurueck.state).toEqual(s.state);
    expect(zurueck.meta.name).toBe('Platz x');
  });

  it('lehnt fremde Dateien ab', () => {
    expect(() => importiereJson('kein json')).toThrow();
    expect(() => importiereJson('{"foo":1}')).toThrow(/Juniorenmanager/);
  });
});
