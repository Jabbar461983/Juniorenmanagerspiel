import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { simulateWeek, PflichtEreignisOffenError } from '../simulation';
import { offenePflichtEreignisse } from '../ereignisse';
import { pflichtEntscheide, simuliereWochen, testSpiel } from './hilfen';
import type { GameState } from '../types';

describe('Zufallsgenerator', () => {
  it('liefert bei gleichem Seed die gleiche Folge', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const fa = Array.from({ length: 20 }, () => a.next());
    const fb = Array.from({ length: 20 }, () => b.next());
    expect(fa).toEqual(fb);
    expect(new Rng(43).next()).not.toBe(fa[0]);
  });

  it('bleibt in den Grenzen', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const x = r.int(3, 7);
      expect(x).toBeGreaterThanOrEqual(3);
      expect(x).toBeLessThanOrEqual(7);
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe('Determinismus des Spielkerns', () => {
  it('neues Spiel mit gleichem Seed ist identisch', () => {
    expect(JSON.stringify(testSpiel(7))).toBe(JSON.stringify(testSpiel(7)));
    expect(JSON.stringify(testSpiel(7))).not.toBe(JSON.stringify(testSpiel(8)));
  });

  it('gleicher Spielstand + gleiche Entscheide = gleiches Ergebnis', () => {
    const s = simuliereWochen(testSpiel(99), 5);
    const d = [...pflichtEntscheide(s), { typ: 'anwerbung' as const, massnahmeId: 'flyer' }];
    const r1 = simulateWeek(s, d);
    const r2 = simulateWeek(s, d);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('verändert den übergebenen Spielstand nicht', () => {
    const s = testSpiel(5);
    const vorher = JSON.stringify(s);
    simulateWeek(s, pflichtEntscheide(s));
    expect(JSON.stringify(s)).toBe(vorher);
  });

  it('ist nach JSON-Speichern und -Laden identisch weiterspielbar', () => {
    const s = simuliereWochen(testSpiel(3), 20);
    const geladen = JSON.parse(JSON.stringify(s)) as GameState;
    const a = simuliereWochen(s, 15);
    const b = simuliereWochen(geladen, 15);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('eine ganze Saison ist reproduzierbar', () => {
    const a = simuliereWochen(testSpiel(2024), 52);
    const b = simuliereWochen(testSpiel(2024), 52);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.bilanzen).toHaveLength(1);
  });

  it('blockiert bei offenen Pflicht-Ereignissen', () => {
    let s = testSpiel(1);
    // So lange simulieren, bis ein Pflicht-Ereignis offen ist
    for (let i = 0; i < 30 && offenePflichtEreignisse(s).length === 0; i++) s = simulateWeek(s, []).state;
    expect(offenePflichtEreignisse(s).length).toBeGreaterThan(0);
    expect(() => simulateWeek(s, [])).toThrow(PflichtEreignisOffenError);
    expect(() => simulateWeek(s, pflichtEntscheide(s))).not.toThrow();
  });
});
