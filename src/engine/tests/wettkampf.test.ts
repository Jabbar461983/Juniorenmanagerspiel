import { describe, expect, it } from 'vitest';
import { Rng } from '../rng';
import { jederGegenJeden, simulierePlayoffWoche, tabelle, verteile, aktuelleRunde } from '../wettkampf';
import { simuliereWochen, testSpiel } from './hilfen';
import type { Meisterschaft, Spiel, WettkampfTeam } from '../types';

function teams(n: number): WettkampfTeam[] {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `Team ${i}`, staerke: 10 + i * 0.5 }));
}

describe('Spielplan', () => {
  it('jeder gegen jeden: jede Paarung genau einmal', () => {
    for (const n of [6, 8, 10]) {
      const ids = teams(n).map((t) => t.id);
      const runden = jederGegenJeden(ids);
      expect(runden).toHaveLength(n - 1);
      const paare = new Set<string>();
      for (const r of runden) {
        expect(r).toHaveLength(n / 2);
        const inRunde = new Set(r.flat());
        expect(inRunde.size).toBe(n);
        for (const [a, b] of r) paare.add([a, b].sort().join('-'));
      }
      expect(paare.size).toBe((n * (n - 1)) / 2);
    }
  });

  it('verteilt Termine gleichmässig', () => {
    expect(verteile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([2, 4, 6, 8, 10]);
  });
});

describe('Tabelle', () => {
  it('sortiert nach Punkten, Tordifferenz, Toren', () => {
    const t = teams(3);
    const spiele: Spiel[] = [
      { woche: 1, heimId: 't0', gastId: 't1', toreHeim: 3, toreGast: 1, typ: 'liga' },
      { woche: 1, heimId: 't1', gastId: 't2', toreHeim: 2, toreGast: 2, typ: 'liga' },
      { woche: 2, heimId: 't2', gastId: 't0', toreHeim: 5, toreGast: 0, typ: 'liga' }
    ];
    const tab = tabelle(t, spiele);
    expect(tab.map((z) => z.id)).toEqual(['t2', 't0', 't1']);
    expect(tab[0]!.punkte).toBe(4);
    expect(tab[1]!.punkte).toBe(3);
    expect(tab[2]!.punkte).toBe(1);
  });
});

describe('Wettkampfmodus über eine Saison', () => {
  const s = simuliereWochen(testSpiel(31), 51);
  const wk = s.wettkampf;

  it('U12 und U15: 8 Teams, 8 Turniere, die ersten 6 am Finalturnier', () => {
    for (const stufe of ['U12', 'U15'] as const) {
      const liga = wk.ligen[stufe];
      expect(liga.teams).toHaveLength(8);
      expect(liga.turnierWochen).toHaveLength(8);
      expect(liga.finalTeilnehmer).toHaveLength(6);
      const tab = tabelle(liga.teams, liga.spiele.filter((x) => x.typ === 'liga'));
      expect(liga.finalTeilnehmer).toEqual(tab.slice(0, 6).map((z) => z.id));
      expect(liga.finalRangliste).toHaveLength(6);
      // Finalturnier im Mai (Abschlussphase)
      expect(liga.finalWoche).toBeGreaterThanOrEqual(48);
    }
  });

  it('U18: 10 Teams, Hin- und Rückrunde, 8 in den Playoffs', () => {
    const m = wk.u18;
    expect(m.teams).toHaveLength(10);
    const regulaer = m.spiele.filter((x) => x.typ === 'meisterschaft');
    expect(regulaer).toHaveLength(90);
    const vf = m.playoffs.filter((x) => x.runde === 'viertelfinal');
    expect(vf).toHaveLength(4);
    const tab = tabelle(m.teams, regulaer);
    const teilnehmer = vf.flatMap((x) => [x.hoehergesetztId, x.tiefergesetztId]).sort();
    expect(teilnehmer).toEqual(tab.slice(0, 8).map((z) => z.id).sort());
    // 1 gegen 8
    expect(vf[0]!.hoehergesetztId).toBe(tab[0]!.id);
    expect(vf[0]!.tiefergesetztId).toBe(tab[7]!.id);
    expect(m.playoffs.filter((x) => x.runde === 'halbfinal')).toHaveLength(2);
    expect(m.playoffs.filter((x) => x.runde === 'final')).toHaveLength(1);
    expect(m.meisterId).toBeDefined();
  });

  it('Playoff-Serien sind best of 3', () => {
    for (const serie of wk.u18.playoffs) {
      expect(serie.spiele.length).toBeGreaterThanOrEqual(2);
      expect(serie.spiele.length).toBeLessThanOrEqual(3);
      expect(Math.max(serie.siegeHoeher, serie.siegeTiefer)).toBe(2);
      expect(Math.min(serie.siegeHoeher, serie.siegeTiefer)).toBeLessThanOrEqual(1);
      for (const sp of serie.spiele) expect(sp.toreHeim).not.toBe(sp.toreGast);
    }
  });

  it('U9 spielt Turniere ohne Rangliste', () => {
    expect(wk.u9.turnierWochen).toHaveLength(6);
    expect(wk.u9.spiele.length).toBeGreaterThan(0);
    expect(wk.u9.spiele.every((x) => x.typ === 'turnier')).toBe(true);
  });
});

describe('Playoff-Ablauf', () => {
  it('beendet eine Serie nach zwei Siegen und startet die nächste Runde erst in der Folgewoche', () => {
    const t = teams(10);
    const m: Meisterschaft = { teams: t, runden: [], spiele: [], playoffStartWoche: 40, setzliste: [], playoffs: [] };
    const rng = new Rng(77);
    const staerken = {};
    simulierePlayoffWoche(m, rng, 40, staerken);
    expect(aktuelleRunde(m)).toBe('viertelfinal');
    expect(m.playoffs).toHaveLength(4);
    for (const s of m.playoffs) expect(s.spiele).toHaveLength(2);
    let woche = 41;
    while (!m.meisterId && woche < 60) simulierePlayoffWoche(m, rng, woche++, staerken);
    expect(m.meisterId).toBeDefined();
    expect(m.playoffs).toHaveLength(7);
    // Halbfinal beginnt nicht in derselben Woche, in der der letzte Viertelfinal endet
    const vfEnde = Math.max(...m.playoffs.filter((s) => s.runde === 'viertelfinal').flatMap((s) => s.spiele.map((x) => x.woche)));
    const hfStart = Math.min(...m.playoffs.filter((s) => s.runde === 'halbfinal').flatMap((s) => s.spiele.map((x) => x.woche)));
    expect(hfStart).toBeGreaterThan(vfEnde);
  });
});
