import { describe, expect, it } from 'vitest';
import { B } from '../config';
import { naechsteZufriedenheit, teamKontext, zielFaktoren, zielwert } from '../zufriedenheit';
import { teamKinder } from '../personen';
import { testSpiel } from './hilfen';

describe('Zufriedenheitsformel', () => {
  it('Gewichte ergeben 100 %', () => {
    const g = B.zufriedenheit.gewichte;
    const summe = Object.values(g).reduce((a, b) => a + b, 0);
    expect(summe).toBeCloseTo(1, 10);
    expect(g.trainerbeziehung).toBe(0.25);
    expect(g.teamklima).toBe(0.2);
    expect(g.spassEinsatz).toBe(0.2);
    expect(g.entwicklung).toBe(0.15);
    expect(g.elterneinfluss).toBe(0.1);
    expect(g.rahmen).toBe(0.1);
  });

  it('Zielwert ist der gewichtete Durchschnitt', () => {
    expect(
      zielwert({ trainerbeziehung: 100, teamklima: 0, spassEinsatz: 0, entwicklung: 0, elterneinfluss: 0, rahmen: 0 })
    ).toBeCloseTo(25);
    expect(
      zielwert({ trainerbeziehung: 80, teamklima: 60, spassEinsatz: 40, entwicklung: 100, elterneinfluss: 20, rahmen: 50 })
    ).toBeCloseTo(80 * 0.25 + 60 * 0.2 + 40 * 0.2 + 100 * 0.15 + 20 * 0.1 + 50 * 0.1);
  });

  it('Z_neu = Z_alt + 0.2 × (Z_ziel − Z_alt) + E', () => {
    expect(naechsteZufriedenheit(50, 80, 0)).toBeCloseTo(56);
    expect(naechsteZufriedenheit(50, 80, 8)).toBeCloseTo(64);
    expect(naechsteZufriedenheit(70, 40, -15)).toBeCloseTo(49);
  });

  it('bleibt zwischen 0 und 100', () => {
    expect(naechsteZufriedenheit(95, 100, 20)).toBe(100);
    expect(naechsteZufriedenheit(5, 0, -20)).toBe(0);
  });

  it('nähert sich ohne Effekte dem Zielwert an', () => {
    let z = 20;
    for (let i = 0; i < 40; i++) z = naechsteZufriedenheit(z, 70, 0);
    expect(z).toBeCloseTo(70, 1);
  });

  it('Faktoren liegen zwischen 0 und 100; Team ohne Trainer senkt die Trainerbeziehung', () => {
    const s = testSpiel(11);
    const team = Object.values(s.teams)[0]!;
    const kind = teamKinder(s, team.id)[0]!;
    const mit = zielFaktoren(s, kind, teamKontext(s, team));
    for (const v of Object.values(mit)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    team.trainer = [];
    const ohne = zielFaktoren(s, kind, teamKontext(s, team));
    expect(ohne.trainerbeziehung).toBeLessThan(mit.trainerbeziehung);
  });

  it('höhere Beiträge senken den Faktor Rahmen', () => {
    const s = testSpiel(11);
    const team = Object.values(s.teams).find((t) => t.stufe === 'U12')!;
    const kind = teamKinder(s, team.id)[0]!;
    const vorher = zielFaktoren(s, kind, teamKontext(s, team)).rahmen;
    s.finanzen.beitraege.U12 *= 2;
    const nachher = zielFaktoren(s, kind, teamKontext(s, team)).rahmen;
    expect(nachher).toBeLessThan(vorher);
  });
});
