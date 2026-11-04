import { describe, expect, it } from 'vitest';
import { B, EREIGNIS_VORLAGEN, DIALOGE, AKTIVITAETEN } from '../config';
import { abstimmen, generalversammlung, haltungKategorie, istSitzungswoche, neuerAntrag, zustimmung } from '../vorstand';
import { endbewertung, finanzWert, juniorenWert, kernbewertung } from '../bewertung';
import { postVeroeffentlichen, reichweiteFaktor, socialWoche } from '../social';
import { anfrageWahrscheinlichkeit, sponsorAngebot, sponsorAnnehmen, sponsorenSaisonstart } from '../sponsoren';
import { migriere, SCHEMA_VERSION } from '../migrations';
import { neuesSpiel } from '../neuesSpiel';
import { Rng } from '../rng';
import { simulateWeek } from '../simulation';
import type { Entscheid, GameState } from '../types';
import { pflichtEntscheide, simuliereWochen, testSpiel } from './hilfen';

function bisSitzung(s: GameState, extra: Entscheid[] = []): GameState {
  let x = s;
  let erste = true;
  while (!istSitzungswoche(x)) {
    x = simulateWeek(x, [...pflichtEntscheide(x), ...(erste ? extra : [])]).state;
    erste = false;
  }
  return simulateWeek(x, [...pflichtEntscheide(x), ...(erste ? extra : [])]).state;
}

describe('Inhalte Etappe 3', () => {
  it('mindestens 10 neue Ereignisse und 5 Vorstands-Dialoge, 7 Aktivitäten', () => {
    expect(EREIGNIS_VORLAGEN.length).toBeGreaterThanOrEqual(35);
    expect(DIALOGE.filter((d) => d.art === 'vorstand').length).toBeGreaterThanOrEqual(5);
    expect(AKTIVITAETEN.map((a) => a.id).sort()).toEqual(['altpapier', 'crowdfunding', 'gesuch', 'gruempel', 'kuchen', 'lotto', 'sponsorenlauf']);
  });

  it('neues Spiel hat fünf Vorstandsmitglieder mit allen Ämtern', () => {
    const s = testSpiel(1);
    const aemter = Object.values(s.vorstand.mitglieder).map((m) => m.amt).sort();
    expect(aemter).toEqual(['beisitz', 'kasse', 'kommunikation', 'praesidium', 'sportchef']);
    expect(s.verein.vorstandEinfluss).toBe(B.vorstand.einfluss.start);
  });
});

describe('Abstimmung', () => {
  it('Haltung, Einfluss und Betrag beeinflussen die Zustimmung', () => {
    const s = testSpiel(2);
    const m = Object.values(s.vorstand.mitglieder)[0]!;
    const antrag = { typ: 'budget' as const, betrag: 500 };
    m.haltung = 50;
    const hoch = zustimmung(s, m, antrag);
    m.haltung = -50;
    const tief = zustimmung(s, m, antrag);
    expect(hoch).toBeGreaterThan(tief);
    m.haltung = 0;
    const klein = zustimmung(s, m, { typ: 'budget', betrag: 200 });
    const gross = zustimmung(s, m, { typ: 'budget', betrag: 3000 });
    expect(klein).toBeGreaterThan(gross);
    s.verein.vorstandEinfluss = 90;
    const einflussreich = zustimmung(s, m, antrag);
    s.verein.vorstandEinfluss = 20;
    expect(einflussreich).toBeGreaterThan(zustimmung(s, m, antrag));
  });

  it('Mehrheit entscheidet; geschlossene Unterstützung führt zur Annahme, geschlossene Ablehnung nicht', () => {
    const s = testSpiel(3);
    for (const m of Object.values(s.vorstand.mitglieder)) m.haltung = 100;
    s.verein.vorstandEinfluss = 100;
    const a = neuerAntrag(s, 'material', 300);
    expect(abstimmen(s, new Rng(1), a).angenommen).toBe(true);
    for (const m of Object.values(s.vorstand.mitglieder)) m.haltung = -100;
    s.verein.vorstandEinfluss = 0;
    const e = abstimmen(s, new Rng(1), a);
    expect(e.angenommen).toBe(false);
    expect(e.stimmen).toHaveLength(5);
    s.vorstand.spielerImVorstand = true;
    expect(abstimmen(s, new Rng(1), a).stimmen).toHaveLength(6);
  });

  it('Anträge werden in der Sitzung behandelt und bei Annahme ausbezahlt', () => {
    const s = testSpiel(4);
    for (const m of Object.values(s.vorstand.mitglieder)) m.haltung = 100;
    s.verein.vorstandEinfluss = 100;
    const nach = bisSitzung(s, [{ typ: 'antrag', antragTyp: 'material', betrag: 500 }]);
    const sitzung = nach.vorstand.sitzungen.at(-1)!;
    expect(sitzung.ergebnisse).toHaveLength(1);
    expect(sitzung.ergebnisse[0]!.angenommen).toBe(true);
    expect(nach.finanzen.buchungen.some((b) => b.kategorie === 'vorstand' && b.betrag === 500)).toBe(true);
    expect(nach.vorstand.offeneAntraege).toHaveLength(0);
  });
});

describe('Einfluss', () => {
  it('bleibt zwischen 0 und 100 und reagiert auf die Lage', () => {
    let s = testSpiel(5);
    s.verein.vorstandEinfluss = 99;
    s = simuliereWochen(s, 20);
    expect(s.verein.vorstandEinfluss).toBeLessThanOrEqual(100);
    expect(s.verein.vorstandEinfluss).toBeLessThan(99);
    let t = testSpiel(5);
    t.verein.vorstandEinfluss = 2;
    t.lernmodus = true;
    t = simuliereWochen(t, 20);
    expect(t.verein.vorstandEinfluss).toBeGreaterThanOrEqual(0);
    expect(t.verein.vorstandEinfluss).toBeGreaterThan(2);
  });

  it('Haltungskategorien', () => {
    expect(haltungKategorie(40)).toBe('unterstuetzer');
    expect(haltungKategorie(0)).toBe('neutral');
    expect(haltungKategorie(-40)).toBe('skeptisch');
  });
});

describe('GV und Jahresbudget', () => {
  it('höherer Einfluss ergibt ein höheres Jahresbudget; Kürzung wirkt; Wahl ab Einfluss 60', () => {
    const s = testSpiel(6);
    s.woche = B.vorstand.gv.woche;
    s.verein.vorstandEinfluss = 30;
    generalversammlung(s, []);
    const tief = s.vorstand.jahresbudget;
    expect(s.vorstand.spielerImVorstand).toBe(false);
    s.verein.vorstandEinfluss = 80;
    generalversammlung(s, []);
    const hoch = s.vorstand.jahresbudget;
    expect(hoch).toBeGreaterThan(tief);
    expect(s.vorstand.spielerImVorstand).toBe(true);
    s.vorstand.kuerzung = 0.3;
    generalversammlung(s, []);
    expect(s.vorstand.jahresbudget).toBeLessThan(hoch);
    expect(s.vorstand.kuerzung).toBe(0);
  });

  it('das Jahresbudget wird zu Beginn der nächsten Saison gebucht', () => {
    const s = simuliereWochen(testSpiel(7), 53);
    const budget = s.finanzen.buchungen.find((b) => b.saison === 2 && b.kategorie === 'vereinsbeitrag');
    expect(budget).toBeDefined();
    expect(budget!.betrag).toBe(s.vorstand.gv.at(-1)!.jahresbudget);
  });
});

describe('Konkurs-Kette und vorzeitiges Spielende', () => {
  it('Massnahmen, Kürzung, Absetzung', () => {
    let s = testSpiel(8);
    s.finanzen.kasse = -50000;
    const stufen: number[] = [];
    for (let i = 0; i < 14 && !s.spielende; i++) {
      // ohne Rettungsplan: bei «Massnahmen» nichts unternehmen
      const d = pflichtEntscheide(s).map((e) =>
        e.typ === 'ereignis' && s.ereignisse.find((x) => x.id === e.ereignisId)?.vorlageId === 'budget_massnahmen' ? { ...e, optionId: 'ignorieren' } : e
      );
      s = simulateWeek(s, d).state;
      stufen.push(s.vorstand.konkursStufe);
    }
    expect(stufen[1]).toBe(1);
    expect(stufen[5]).toBe(2);
    expect(s.spielende?.grund).toBe('konkurs');
    expect(s.spielende?.endbewertung).toBeDefined();
  });

  it('Lernmodus verhindert das vorzeitige Ende', () => {
    let s = neuesSpiel({ vereinsname: 'Lern', seed: 8, lernmodus: true });
    s.finanzen.kasse = -50000;
    s.verein.vorstandEinfluss = 0;
    s = simuliereWochen(s, 20);
    expect(s.spielende).toBeUndefined();
  });

  it('Absetzung bei Einfluss unter 10', () => {
    let s = testSpiel(9);
    s.verein.vorstandEinfluss = 3;
    s = simulateWeek(s, pflichtEntscheide(s)).state;
    expect(s.spielende?.grund).toBe('absetzung');
    expect(() => simulateWeek(s, [])).toThrow();
  });

  it('Auflösung, wenn kein Team mehr spielfähig ist', () => {
    let s = testSpiel(10);
    for (const t of Object.values(s.teams)) t.trainer = [];
    for (let i = 0; i < 6 && !s.spielende; i++) s = simulateWeek(s, pflichtEntscheide(s)).state;
    expect(s.spielende?.grund).toBe('aufgeloest');
  });
});

describe('Sponsoren', () => {
  it('Angebot, Vertrag, Zahlung und Ende nach der Laufzeit bei unzufriedenem Sponsor', () => {
    const s = testSpiel(11);
    const sp = sponsorAngebot(s, new Rng(1));
    expect(sp.status).toBe('angebot');
    const vorher = s.finanzen.kasse;
    sponsorAnnehmen(s, sp, [], []);
    expect(sp.status).toBe('aktiv');
    expect(s.finanzen.kasse).toBe(vorher + sp.betrag);
    s.saison += sp.laufzeit;
    sp.zufriedenheit = 10;
    sponsorenSaisonstart(s, [], []);
    expect(sp.status).toBe('beendet');
  });

  it('Reichweite und Ruf erhöhen die Anfragen; laufende Verträge sättigen den Markt', () => {
    const s = testSpiel(12);
    const basis = anfrageWahrscheinlichkeit(s);
    s.social.reichweite = 80;
    s.verein.ruf = 90;
    const hoch = anfrageWahrscheinlichkeit(s);
    expect(hoch).toBeGreaterThan(basis);
    sponsorAnnehmen(s, sponsorAngebot(s, new Rng(2)), [], []);
    expect(anfrageWahrscheinlichkeit(s)).toBeLessThan(hoch);
  });
});

describe('Social Media', () => {
  it('Posts erhöhen Reichweite und Ruf, die Reichweite zerfällt', () => {
    const s = testSpiel(13);
    const r0 = s.social.reichweite;
    const ruf0 = s.verein.ruf;
    postVeroeffentlichen(s, new Rng(1), 'trainerportrait', null, 'keine', 0, []);
    expect(s.social.reichweite).toBeGreaterThan(r0);
    expect(s.verein.ruf).toBeGreaterThan(ruf0);
    const r1 = s.social.reichweite;
    socialWoche(s);
    expect(s.social.reichweite).toBeLessThan(r1);
    s.social.reichweite = 80;
    expect(reichweiteFaktor(s)).toBeGreaterThan(1);
  });

  it('Bilder ohne Einwilligung können ein Ereignis auslösen, «nur mit Einwilligung» nie', () => {
    const s = testSpiel(14);
    const team = Object.values(s.teams)[0]!;
    for (const f of Object.values(s.familien)) f.fotoEinwilligung = false;
    let probleme = 0;
    for (let i = 0; i < 20; i++) if (postVeroeffentlichen(s, new Rng(i), 'training', team.id, 'alle', 0, []).betroffen) probleme++;
    expect(probleme).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) expect(postVeroeffentlichen(s, new Rng(i), 'training', team.id, 'nurMitEinwilligung', 0, []).betroffen).toBeNull();
  });

  it('Post mit allen Bildern löst in der Simulation das Pflicht-Ereignis aus', () => {
    let s = testSpiel(15);
    for (const f of Object.values(s.familien)) f.fotoEinwilligung = false;
    const team = Object.keys(s.teams)[0]!;
    let gefunden = false;
    for (let i = 0; i < 6 && !gefunden; i++) {
      s = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'post', postTyp: 'training', teamId: team, bilder: 'alle', werbung: 0 }]).state;
      gefunden = s.ereignisse.some((e) => e.vorlageId === 'post_ohne_einwilligung');
    }
    expect(gefunden).toBe(true);
  });
});

describe('Geldbeschaffung', () => {
  it('Aktivität kostet bei Start und bringt nach der Vorbereitung Ertrag', () => {
    let s = testSpiel(16);
    s = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'aktivitaet', aktivitaetId: 'altpapier' }]).state;
    expect(s.aktivitaeten).toHaveLength(1);
    s = simuliereWochen(s, 3);
    const a = s.aktivitaeten[0]!;
    expect(a.status).toBe('abgeschlossen');
    expect(s.finanzen.buchungen.some((b) => b.kategorie === 'anlaesse' && b.betrag > 0) || a.ertrag === 0).toBe(true);
  });

  it('Aktivitäten ausserhalb ihrer Phase sind nicht möglich', () => {
    const s = testSpiel(17);
    const r = simulateWeek(s, [...pflichtEntscheide(s), { typ: 'aktivitaet', aktivitaetId: 'lotto' }]);
    expect(r.report.fehler.some((f) => f.includes('Lotto'))).toBe(true);
  });
});

describe('Endbewertung', () => {
  it('Kriterien und Gewichte gemäss Konzept, 0–100 Punkte', () => {
    const s = testSpiel(18);
    const e = endbewertung(s);
    const g = Object.fromEntries(e.kriterien.map((k) => [k.id, k.gewicht]));
    expect(g).toEqual({ junioren: 0.35, zufriedenheit: 0.35, rufEinfluss: 0.1, trainer: 0.1, heikleFaelle: 0.05, finanzen: 0.05 });
    expect(e.punkte).toBeGreaterThan(0);
    expect(e.punkte).toBeLessThanOrEqual(100);
    expect(e.titel.length).toBeGreaterThan(0);
  });

  it('100 zufriedene Kinder schneiden besser ab als 150 unglückliche', () => {
    expect(kernbewertung(100, 80)).toBeGreaterThan(kernbewertung(150, 40));
    expect(juniorenWert(60)).toBeGreaterThan(juniorenWert(40));
    expect(finanzWert(-2000)).toBeLessThan(finanzWert(5000));
  });
});

describe('Migration Etappe 2 → 3 und mehrere Saisons', () => {
  it('ergänzt Vorstand und Co. und hebt das Etappen-Ende auf', () => {
    const s = simuliereWochen(testSpiel(19), 52);
    const alt = JSON.parse(JSON.stringify(s)) as Record<string, any>;
    alt['schemaVersion'] = 2;
    for (const k of ['vorstand', 'social', 'sponsoren', 'aktivitaeten', 'chronik', 'lernmodus', 'sponsorSucheBis']) delete alt[k];
    for (const f of Object.values(alt['familien']) as Record<string, unknown>[]) delete f['fotoEinwilligung'];
    alt['spielende'] = { grund: 'etappenEnde', punkte: 100, titel: 'x', text: 'x' };
    const neu = migriere(alt);
    expect(neu.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Object.keys(neu.vorstand.mitglieder)).toHaveLength(5);
    expect(neu.spielende).toBeUndefined();
    expect(typeof Object.values(neu.familien)[0]!.fotoEinwilligung).toBe('boolean');
    expect(JSON.stringify(migriere(JSON.parse(JSON.stringify(alt))))).toBe(JSON.stringify(neu));
    expect(() => simuliereWochen(neu, 4)).not.toThrow();
  });

  it('drei Saisons sind reproduzierbar', () => {
    const extra = (_s: GameState, i: number): Entscheid[] =>
      i % 4 === 1 ? [{ typ: 'antrag', antragTyp: 'material', betrag: 600 }, { typ: 'post', postTyp: 'training', teamId: null, bilder: 'keine', werbung: 50 }] : [];
    const a = simuliereWochen(testSpiel(2030), 156, extra);
    const b = simuliereWochen(testSpiel(2030), 156, extra);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.bilanzen.length).toBe(3);
  });
});

describe('Vorstands-Ereignisse und -Dialoge', () => {
  it('jede Vorlage mit Dialog-Option verweist auf einen Dialog der passenden Rolle', () => {
    for (const v of EREIGNIS_VORLAGEN) {
      for (const o of v.optionen.filter((x) => x.dialog)) {
        const d = DIALOGE.find((x) => x.id === o.dialog)!;
        const rolle = v.beteiligte.find((b) => b.rolle === o.dialogPerson);
        expect(rolle, `${v.id}/${o.id}`).toBeDefined();
        expect(d.art).toBe(rolle!.art);
      }
    }
  });
});
