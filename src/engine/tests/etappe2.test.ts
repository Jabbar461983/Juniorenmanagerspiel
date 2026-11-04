import { describe, expect, it } from 'vitest';
import { B, DIALOGE, EREIGNIS_VORLAGEN } from '../config';
import { dialogAuswerten, tonWirkung, verfuegbareDialoge } from '../dialoge';
import { ausstandBehandeln, elternAnsteckung, interessenkonflikte, teamEltern, zahlungen } from '../eltern';
import { trainerAusElternteil } from '../generator';
import { migriere, SCHEMA_VERSION } from '../migrations';
import { teamKinder } from '../personen';
import { Rng } from '../rng';
import { simulateWeek } from '../simulation';
import type { Elternteil, Entscheid, GameState } from '../types';
import { pflichtEntscheide, simuliereWochen, testSpiel } from './hilfen';

function elternteilMitTeam(s: GameState): Elternteil {
  const k = Object.values(s.kinder).find((x) => x.teamId && x.status === 'aktiv')!;
  return s.eltern[s.familien[k.familieId]!.elternIds[0]!]!;
}

describe('Dialoge: Inhalte', () => {
  it('mindestens 8 Dialogbäume mit 2 Ebenen; alle Folgeknoten existieren', () => {
    expect(DIALOGE.length).toBeGreaterThanOrEqual(8);
    const mehrstufig = DIALOGE.filter((d) => Object.keys(d.knoten).length >= 2);
    expect(mehrstufig.length).toBeGreaterThanOrEqual(8);
    for (const d of DIALOGE) {
      expect(d.knoten[d.start]).toBeDefined();
      for (const k of Object.values(d.knoten)) {
        expect(k.antworten.length).toBeGreaterThanOrEqual(1);
        for (const a of k.antworten) {
          expect(a.weiter !== undefined || a.ende !== undefined).toBe(true);
          const ziele = typeof a.weiter === 'string' ? [a.weiter] : a.weiter ? [a.weiter.dann, a.weiter.sonst] : [];
          for (const z of ziele) expect(d.knoten[z], `${d.id}: Knoten ${z}`).toBeDefined();
        }
      }
    }
  });

  it('Ereignis-Optionen verweisen auf bestehende Dialoge', () => {
    const mitDialog = EREIGNIS_VORLAGEN.flatMap((v) => v.optionen.filter((o) => o.dialog));
    expect(mitDialog.length).toBeGreaterThanOrEqual(8);
    for (const o of mitDialog) expect(DIALOGE.some((d) => d.id === o.dialog)).toBe(true);
    // keine Standardoption startet einen Dialog
    for (const v of EREIGNIS_VORLAGEN) expect(v.optionen.find((o) => o.id === v.standardOption)?.dialog).toBeUndefined();
  });

  it('mindestens 8 neue Eltern-Ereignisse (insgesamt mindestens 23 Vorlagen)', () => {
    expect(EREIGNIS_VORLAGEN.length).toBeGreaterThanOrEqual(23);
  });
});

describe('Dialoge: Auswertung', () => {
  it('ist deterministisch und verändert den Spielstand nicht', () => {
    const s = testSpiel(3);
    const e = elternteilMitTeam(s);
    const vorher = JSON.stringify(s);
    const a = dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['a', 'a']);
    const b = dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['a', 'a']);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(s)).toBe(vorher);
    expect(a.verlauf).toHaveLength(2);
  });

  it('Ton verändert das Vertrauen: empathisch > sachlich > bestimmt > ausweichend (Grundwerte)', () => {
    const s = testSpiel(3);
    const e = { ...elternteilMitTeam(s), typ: 'engagiert' as const, konfliktbereitschaft: 5 };
    const w = (t: 'empathisch' | 'sachlich' | 'bestimmt' | 'ausweichend') => tonWirkung(e, t);
    expect(w('empathisch')).toBeGreaterThan(w('sachlich'));
    expect(w('sachlich')).toBeGreaterThan(w('bestimmt'));
    expect(w('bestimmt')).toBeGreaterThan(w('ausweichend'));
    // Kritiker:innen schätzen Sachlichkeit mehr als Empathie
    const k = { ...e, typ: 'kritiker' as const };
    expect(tonWirkung(k, 'sachlich')).toBeGreaterThan(tonWirkung(k, 'empathisch'));
    // Konfliktbereite reagieren schlecht auf «bestimmt»
    expect(tonWirkung({ ...e, konfliktbereitschaft: 18 }, 'bestimmt')).toBeLessThan(w('bestimmt'));
  });

  it('verborgene Infos kommen erst bei genug Vertrauen ans Licht', () => {
    const s = testSpiel(3);
    const e = elternteilMitTeam(s);
    e.bekannt = [];
    e.vertrauen = -20;
    const tief = dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['a', 'a']);
    expect(tief.offenbart).toEqual([]);
    e.vertrauen = 30;
    const hoch = dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['a', 'a', 'a']);
    expect(hoch.beendet).toBe(true);
    expect(hoch.offenbart).toContain('typ');
  });

  it('ungültige Antworten und unfertige Dialoge werden erkannt', () => {
    const s = testSpiel(3);
    const e = elternteilMitTeam(s);
    expect(dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['x']).fehler).toBeTruthy();
    const offen = dialogAuswerten(s, 'eltern_kennenlernen', e.id, ['a']);
    expect(offen.beendet).toBe(false);
    expect(offen.antworten.length).toBeGreaterThan(0);
  });

  it('Gespräch wird in der Simulation angewendet; höchstens 2 Gespräche pro Woche', () => {
    const s = testSpiel(8);
    const eltern = Object.values(s.eltern)
      .filter((e) => verfuegbareDialoge(s, e.id).some((d) => d.dialog.id === 'eltern_kennenlernen'))
      .slice(0, 3);
    const d: Entscheid[] = eltern.map((e) => ({ typ: 'dialog', dialogId: 'eltern_kennenlernen', personId: e.id, antworten: ['c'] }));
    const r = simulateWeek(s, [...pflichtEntscheide(s), ...d]);
    const gefuehrt = eltern.filter((e) => r.state.eltern[e.id]!.gespraeche.length > 0);
    expect(gefuehrt).toHaveLength(B.dialog.gespraecheProWoche);
    expect(r.report.fehler.some((f) => f.includes('höchstens'))).toBe(true);
    const erste = r.state.eltern[eltern[0]!.id]!;
    expect(erste.vertrauen).not.toBe(eltern[0]!.vertrauen);
    expect(erste.gespraeche[0]!.dialogId).toBe('eltern_kennenlernen');
    // Abkühlzeit: dasselbe Gespräch ist nächste Woche gesperrt
    expect(verfuegbareDialoge(r.state, erste.id).find((x) => x.dialog.id === 'eltern_kennenlernen')?.gesperrt).toBeTruthy();
  });

  it('Fahrdienst-Anfrage: Zusage hängt von der Bereitschaft ab', () => {
    const s = testSpiel(9);
    const e = elternteilMitTeam(s);
    e.engagement = 18;
    e.typ = 'engagiert';
    const ja = dialogAuswerten(s, 'eltern_fahrdienst', e.id, ['b', 'a']);
    expect(ja.beendet).toBe(true);
    expect(ja.effekte.some((x) => x.typ === 'helfer')).toBe(true);
    e.engagement = 2;
    e.typ = 'abwesend';
    const nein = dialogAuswerten(s, 'eltern_fahrdienst', e.id, ['b', 'a']);
    expect(nein.effekte.some((x) => x.typ === 'helfer')).toBe(false);
  });
});

describe('Eltern-Einfluss', () => {
  it('Ansteckung: Stimmungen im Team nähern sich an und bleiben in den Grenzen', () => {
    const s = testSpiel(12);
    const team = Object.values(s.teams).find((t) => teamEltern(s, t.id).length >= 4)!;
    const eltern = teamEltern(s, team.id);
    eltern.forEach((e, i) => (e.stimmung = i % 2 === 0 ? 10 : 90));
    const spanne = () => {
      const w = teamEltern(s, team.id).map((e) => e.stimmung);
      return Math.max(...w) - Math.min(...w);
    };
    const vorher = spanne();
    for (let i = 0; i < 30; i++) elternAnsteckung(s);
    expect(spanne()).toBeLessThan(vorher / 2);
    for (const e of Object.values(s.eltern)) {
      expect(e.stimmung).toBeGreaterThanOrEqual(0);
      expect(e.stimmung).toBeLessThanOrEqual(100);
    }
  });

  it('säumige Familien zahlen nicht; Ausstand wächst, Ratenzahlung baut ihn ab', () => {
    const s = testSpiel(13);
    const f = Object.values(s.familien).find((x) => x.kinderIds.some((id) => s.kinder[id]!.status === 'aktiv'))!;
    for (const x of Object.values(s.familien)) x.saeumig = false;
    for (const e of Object.values(s.eltern)) e.zahlungsmoral = 20;
    f.saeumig = true;
    // Erholung ausschalten: Rng, die nie unter 0.12 liegt, ist nicht garantiert – daher mehrfach prüfen
    const vorher = s.finanzen.kasse;
    const r = zahlungen(s, new Rng(1), []);
    if (f.saeumig) {
      expect(f.ausstand).toBeGreaterThan(0);
      expect(r.offen).toBeGreaterThan(0);
    }
    expect(s.finanzen.kasse).toBeCloseTo(vorher + r.bezahlt + r.raten, 2);
    f.saeumig = false;
    f.ausstand = 100;
    f.ratenzahlung = true;
    zahlungen(s, new Rng(2), []);
    expect(f.ausstand).toBeLessThan(100);
    ausstandBehandeln(s, new Rng(3), f, 'abschreiben', [], []);
    expect(f.ausstand).toBe(0);
  });

  it('Elternabend: bessere Stimmung, Einsatzregeln, Kosten, höchstens 2 pro Saison', () => {
    const s = testSpiel(14);
    const team = Object.values(s.teams)[1]!;
    const stimmungVorher = teamEltern(s, team.id).reduce((a, e) => a + e.stimmung, 0);
    const d: Entscheid[] = [1, 2, 3].map(() => ({ typ: 'elternabend', teamId: team.id }));
    const r = simulateWeek(s, [...pflichtEntscheide(s), ...d]);
    const t2 = r.state.teams[team.id]!;
    expect(t2.elternabende).toBe(2);
    expect(t2.flags['einsatzregeln']).toBe(true);
    expect(r.report.fehler.some((f) => f.includes('Elternabende'))).toBe(true);
    expect(r.report.buchungen.filter((b) => b.kategorie === 'elternarbeit')).toHaveLength(2);
    const stimmungNachher = teamEltern(r.state, team.id).reduce((a, e) => a + e.stimmung, 0);
    expect(stimmungNachher).toBeGreaterThan(stimmungVorher);
  });

  it('Elternteil als Trainer:in im Team des eigenen Kindes ist ein Interessenkonflikt', () => {
    const s = testSpiel(15);
    const team = Object.values(s.teams)[0]!;
    const kind = teamKinder(s, team.id)[0]!;
    const e = s.eltern[s.familien[kind.familieId]!.elternIds[0]!]!;
    expect(interessenkonflikte(s, team)).toHaveLength(0);
    const t = trainerAusElternteil(s, new Rng(1), e);
    team.trainer.push({ trainerId: t.id, rolle: 'betreuer' });
    const k = interessenkonflikte(s, team);
    expect(k).toHaveLength(1);
    expect(k[0]!.kindIds).toContain(kind.id);
  });

  it('Elterntypen sind zu Beginn grösstenteils verborgen', () => {
    const s = testSpiel(16);
    const eltern = Object.values(s.eltern);
    const bekannt = eltern.filter((e) => e.bekannt.includes('typ')).length;
    expect(bekannt).toBeGreaterThan(0);
    expect(bekannt).toBeLessThan(eltern.length / 2);
  });
});

describe('Migration Etappe 1 → 2', () => {
  it('ergänzt die neuen Felder und lässt alte Spielstände weiterlaufen', () => {
    const s = testSpiel(17);
    const alt = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    alt['schemaVersion'] = 1;
    for (const gruppe of ['kinder', 'eltern', 'trainer']) {
      for (const p of Object.values(alt[gruppe]) as Record<string, unknown>[]) {
        delete p['vertrauen'];
        delete p['bekannt'];
        delete p['gespraeche'];
        delete p['helfer'];
        delete p['helferTeamId'];
        delete p['auslastung'];
      }
    }
    for (const f of Object.values(alt['familien']) as Record<string, unknown>[]) {
      delete f['ausstand'];
      delete f['saeumig'];
      delete f['ratenzahlung'];
      delete f['getrennt'];
    }
    for (const t of Object.values(alt['teams']) as Record<string, unknown>[]) delete t['elternabende'];
    const neu = migriere(alt);
    expect(neu.schemaVersion).toBe(SCHEMA_VERSION);
    const e = Object.values(neu.eltern)[0]!;
    expect(e.vertrauen).toBe(0);
    expect(e.bekannt).toContain('typ');
    expect(e.helfer).toBeNull();
    expect(Object.values(neu.familien)[0]!.ausstand).toBe(0);
    expect(Object.values(neu.teams)[0]!.elternabende).toBe(0);
    expect(() => simuliereWochen(neu, 4)).not.toThrow();
  });
});

describe('Determinismus mit Etappe 2', () => {
  it('Saison mit Gesprächen ist reproduzierbar', () => {
    // Pro Woche ein Kennenlern-Gespräch; immer die erste Antwort, bis der Dialog endet
    const fertig = (s: GameState): Entscheid[] => {
      const e = Object.values(s.eltern).find((x) => verfuegbareDialoge(s, x.id).some((d) => d.dialog.id === 'eltern_kennenlernen' && !d.gesperrt));
      if (!e) return [];
      const antworten: string[] = [];
      while (!dialogAuswerten(s, 'eltern_kennenlernen', e.id, antworten).beendet) antworten.push('a');
      return [{ typ: 'dialog', dialogId: 'eltern_kennenlernen', personId: e.id, antworten }];
    };
    const a = simuliereWochen(testSpiel(2025), 52, fertig);
    const b = simuliereWochen(testSpiel(2025), 52, fertig);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Object.values(a.eltern).some((e) => e.gespraeche.length > 0)).toBe(true);
  });
});
