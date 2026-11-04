import { describe, expect, it } from 'vitest';
import { B, EREIGNIS_VORLAGEN } from '../config';
import { saisonKalender, saisonStart } from '../kalender';
import { alter, stimmungAus, teamKinder } from '../personen';
import { berechneTeamWerte } from '../teamwert';
import { erzeugeTrainer } from '../generator';
import { migriere, SCHEMA_VERSION, SpielstandFehler, _registriereMigration } from '../migrations';
import { Rng } from '../rng';
import { testSpiel } from './hilfen';
import type { Phase } from '../types';

describe('Kalender', () => {
  it('Saison mit 52 Wochen von Juni bis Mai und den Phasen in der richtigen Reihenfolge', () => {
    const k = saisonKalender(2026);
    expect(k).toHaveLength(52);
    expect(k[0]!.montag.slice(5, 7)).toMatch(/05|06/);
    expect(new Date(saisonStart(2026)).getUTCDay()).toBe(1);
    const reihenfolge: Phase[] = ['vorbereitung', 'trainingsstart', 'meisterschaft', 'playoffs', 'abschluss'];
    let idx = 0;
    for (const w of k) {
      const i = reihenfolge.indexOf(w.phase);
      expect(i).toBeGreaterThanOrEqual(idx);
      idx = i;
    }
    expect(new Set(k.map((w) => w.phase)).size).toBe(5);
    expect(k[51]!.phase).toBe('abschluss');
  });

  it('erkennt die Schulferien', () => {
    const k = saisonKalender(2026);
    const ferien = new Set(k.filter((w) => w.ferien).map((w) => w.ferien!.id));
    expect(ferien).toEqual(new Set(['sommer', 'herbst', 'winter', 'sport', 'fruehling']));
    expect(k.filter((w) => w.ferien?.id === 'sommer').length).toBeGreaterThanOrEqual(4);
  });
});

describe('Startsituation und Personen', () => {
  const s = testSpiel(5);

  it('vier Teams mit Kindern und 1–4 Trainer:innen', () => {
    const teams = Object.values(s.teams);
    expect(teams.map((t) => t.stufe).sort()).toEqual(['U12', 'U15', 'U18', 'U9']);
    for (const t of teams) {
      expect(teamKinder(s, t.id).length).toBeGreaterThan(5);
      expect(t.trainer.length).toBeGreaterThanOrEqual(1);
      expect(t.trainer.length).toBeLessThanOrEqual(4);
    }
  });

  it('Kinder 6–17 mit 1–2 Elternteilen und Werten 1–20', () => {
    for (const k of Object.values(s.kinder)) {
      const a = alter(s, k);
      expect(a).toBeGreaterThanOrEqual(6);
      expect(a).toBeLessThanOrEqual(17);
      const eltern = s.familien[k.familieId]!.elternIds;
      expect(eltern.length).toBeGreaterThanOrEqual(1);
      expect(eltern.length).toBeLessThanOrEqual(2);
      for (const v of Object.values(k.werte)) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(20);
      }
      expect(k.charakterzuege.length).toBeGreaterThanOrEqual(1);
      expect(k.charakterzuege.length).toBeLessThanOrEqual(2);
      expect(['kind', 'jugend']).toContain(k.portrait.gruppe);
    }
  });

  it('Trainer-Altersprofil: Ältere organisierter und erfahrener, Jüngere mit mehr Kinderverständnis', () => {
    const t = testSpiel(1);
    const rng = new Rng(9);
    const alt = Array.from({ length: 200 }, () => erzeugeTrainer(t, rng, { alter: 60 }));
    const jung = Array.from({ length: 200 }, () => erzeugeTrainer(t, rng, { alter: 20 }));
    const schnitt = (l: typeof alt, f: (x: (typeof alt)[0]) => number) => l.reduce((a, x) => a + f(x), 0) / l.length;
    expect(schnitt(alt, (x) => x.skills.organisation)).toBeGreaterThan(schnitt(jung, (x) => x.skills.organisation) + 3);
    expect(schnitt(alt, (x) => x.skills.erfahrung)).toBeGreaterThan(schnitt(jung, (x) => x.skills.erfahrung) + 3);
    expect(schnitt(jung, (x) => x.skills.kinderverstaendnis)).toBeGreaterThan(schnitt(alt, (x) => x.skills.kinderverstaendnis) + 3);
    expect(schnitt(jung, (x) => x.skills.fachwissen)).toBeGreaterThan(schnitt(alt, (x) => x.skills.fachwissen) + 3);
  });

  it('Stimmung folgt der Zufriedenheit', () => {
    expect(stimmungAus(80)).toBe('froh');
    expect(stimmungAus(67)).toBe('froh');
    expect(stimmungAus(66)).toBe('neutral');
    expect(stimmungAus(34)).toBe('neutral');
    expect(stimmungAus(33)).toBe('bedrueckt');
  });
});

describe('Team-Wert', () => {
  it('bester Wert plus Anteil der übrigen; Generationen- und Geschlechter-Mix werden erkannt', () => {
    const s = testSpiel(6);
    const team = Object.values(s.teams)[0]!;
    const rng = new Rng(3);
    const alt = erzeugeTrainer(s, rng, { alter: 50, geschlecht: 'w' });
    const jung = erzeugeTrainer(s, rng, { alter: 20, geschlecht: 'm' });
    team.trainer = [{ trainerId: alt.id, rolle: 'haupttrainer' }];
    const allein = berechneTeamWerte(s, team);
    team.trainer.push({ trainerId: jung.id, rolle: 'cotrainer' });
    const zu2 = berechneTeamWerte(s, team);
    expect(zu2.skills.kinderverstaendnis).toBeGreaterThan(allein.skills.kinderverstaendnis);
    expect(zu2.generationenMix).toBe(true);
    expect(zu2.geschlechterMix).toBe(true);
    expect(allein.generationenMix).toBe(false);
  });

  it('kaum Zusatznutzen bei mehr als zwei Personen mit gleichem Schwerpunkt', () => {
    const s = testSpiel(6);
    const team = Object.values(s.teams)[0]!;
    const rng = new Rng(4);
    const gleiche = Array.from({ length: 4 }, () => {
      const t = erzeugeTrainer(s, rng, { alter: 30 });
      t.skills = { organisation: 5, kinderverstaendnis: 15, fachwissen: 5, erfahrung: 5, torhueter: 1 };
      return t;
    });
    team.trainer = gleiche.slice(0, 2).map((t) => ({ trainerId: t.id, rolle: 'cotrainer' as const }));
    const zwei = berechneTeamWerte(s, team).skills.kinderverstaendnis;
    team.trainer = gleiche.slice(0, 3).map((t) => ({ trainerId: t.id, rolle: 'cotrainer' as const }));
    const drei = berechneTeamWerte(s, team).skills.kinderverstaendnis;
    const zuwachs2 = zwei - (15 / B.teamwert.maxWert) * 100;
    expect(drei - zwei).toBeLessThan(zuwachs2 / 3);
  });
});

describe('Ereignisse', () => {
  it('mindestens 10 Vorlagen mit gültigen Standardoptionen', () => {
    expect(EREIGNIS_VORLAGEN.length).toBeGreaterThanOrEqual(10);
    for (const v of EREIGNIS_VORLAGEN) {
      expect(v.optionen.map((o) => o.id)).toContain(v.standardOption);
      expect(v.optionen.length).toBeGreaterThanOrEqual(2);
    }
    for (const id of ['trainerabsage', 'halle_doppelt', 'ferien_abwesenheit', 'eltern_spielzeit']) {
      expect(EREIGNIS_VORLAGEN.find((v) => v.id === id)).toBeDefined();
    }
  });
});

describe('Spielstand und Migrationen', () => {
  it('lehnt ungültige und zu neue Spielstände ab', () => {
    expect(() => migriere(null)).toThrow(SpielstandFehler);
    expect(() => migriere({})).toThrow(SpielstandFehler);
    expect(() => migriere({ ...testSpiel(1), schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/neueren/);
  });

  it('akzeptiert den aktuellen Spielstand und wendet Migrationen an', () => {
    const s = testSpiel(1);
    expect(migriere(JSON.parse(JSON.stringify(s)))).toEqual(s);
    _registriereMigration(0, (raw) => ({ ...raw, schemaVersion: 1, migriert: true }));
    const alt = { ...JSON.parse(JSON.stringify(s)), schemaVersion: 0 };
    const neu = migriere(alt) as unknown as Record<string, unknown>;
    expect(neu['schemaVersion']).toBe(SCHEMA_VERSION);
    expect(neu['migriert']).toBe(true);
  });
});
