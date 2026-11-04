import { describe, expect, it } from 'vitest';
import { B } from '../config';
import { jahresbeitrag } from '../finanzen';
import { aktiveKinder, aktiveTrainer, teamsVonTrainer } from '../personen';
import { simulateWeek } from '../simulation';
import { erzeugeFamilie, erzeugeKind } from '../generator';
import { Rng } from '../rng';
import { pflichtEntscheide, testSpiel } from './hilfen';

describe('Buchungen', () => {
  it('bucht wöchentlich Beiträge, Hallenmiete, Material und Entschädigung', () => {
    const s = testSpiel(41);
    const erwarteteBeitraege = aktiveKinder(s).reduce((sum, k) => sum + jahresbeitrag(s, k) / 52, 0);
    const r = simulateWeek(s, pflichtEntscheide(s));
    const b = r.report.buchungen;
    const summe = (kat: string) => b.filter((x) => x.kategorie === kat).reduce((sum, x) => sum + x.betrag, 0);
    expect(summe('beitraege')).toBeGreaterThan(0);
    expect(summe('beitraege')).toBeCloseTo(erwarteteBeitraege, 0);
    expect(summe('material')).toBe(-B.finanzen.material.mittel);
    expect(summe('hallenmiete')).toBeLessThan(0);
    const trainer = aktiveTrainer(s).filter((t) => teamsVonTrainer(s, t.id).length > 0).length;
    expect(summe('trainerentschaedigung')).toBe(-trainer * B.finanzen.entschaedigungProTrainer.mittel);
    // Kasse = vorher + Summe aller Buchungen
    const total = b.reduce((sum, x) => sum + x.betrag, 0);
    expect(r.state.finanzen.kasse).toBeCloseTo(s.finanzen.kasse + total, 2);
  });

  it('Anwerbung kostet und bringt Schnupperkinder', () => {
    const s = testSpiel(42);
    const r = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'anwerbung', massnahmeId: 'schnuppertag' }]);
    const kosten = r.report.buchungen.filter((x) => x.kategorie === 'anwerbung');
    expect(kosten).toHaveLength(1);
    expect(kosten[0]!.betrag).toBe(-300);
  });

  it('Geschwisterrabatt und Härtefallfonds senken den Beitrag', () => {
    const s = testSpiel(43);
    const rng = new Rng(1);
    const fam = erzeugeFamilie(s, rng);
    fam.einkommen = 'tief';
    const gross = erzeugeKind(s, rng, fam, { alter: 12 });
    const klein = erzeugeKind(s, rng, fam, { alter: 9 });
    gross.teamId = Object.values(s.teams).find((t) => t.stufe === 'U15')!.id;
    klein.teamId = Object.values(s.teams).find((t) => t.stufe === 'U12')!.id;
    expect(jahresbeitrag(s, gross)).toBe(s.finanzen.beitraege.U15);
    expect(jahresbeitrag(s, klein)).toBeCloseTo(s.finanzen.beitraege.U12 * (1 - s.finanzen.geschwisterrabatt / 100));
    s.finanzen.haertefallfonds = true;
    expect(jahresbeitrag(s, gross)).toBeCloseTo(s.finanzen.beitraege.U15 * (1 - B.finanzen.haertefallRabatt));
  });

  it('Beiträge sind nur in der Vorbereitung änderbar', () => {
    let s = testSpiel(44);
    let r = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'beitrag', stufe: 'U9', betrag: 250 }]);
    expect(r.state.finanzen.beitraege.U9).toBe(250);
    s = r.state;
    while (s.woche < 12) s = simulateWeek(s, pflichtEntscheide(s)).state;
    r = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'beitrag', stufe: 'U9', betrag: 400 }]);
    expect(r.state.finanzen.beitraege.U9).toBe(250);
    expect(r.report.fehler.length).toBeGreaterThan(0);
  });

  it('verlangt Massnahmen, wenn die Kasse zwei Wochen in Folge unter null ist', () => {
    let s = testSpiel(45);
    s.finanzen.kasse = -5000;
    s = simulateWeek(s, pflichtEntscheide(s)).state;
    expect(s.finanzen.wochenUnterNull).toBe(1);
    expect(s.ereignisse.some((e) => e.vorlageId === 'budget_massnahmen')).toBe(false);
    s = simulateWeek(s, pflichtEntscheide(s)).state;
    expect(s.finanzen.wochenUnterNull).toBe(2);
    expect(s.vorstand.konkursStufe).toBe(1);
    expect(s.ereignisse.some((e) => e.vorlageId === 'budget_massnahmen' && e.pflicht)).toBe(true);
  });
});
