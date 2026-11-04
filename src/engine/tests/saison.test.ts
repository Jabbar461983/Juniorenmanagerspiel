import { describe, expect, it } from 'vitest';
import { bewertung } from '../saison';
import { alter, stufeFuerAlter } from '../personen';
import { simuliereWochen, testSpiel } from './hilfen';
import { B } from '../config';
import { neuesSpiel } from '../neuesSpiel';

describe('Übertritte am Saisonende', () => {
  it('Kinder steigen nach Jahrgang auf, U18-Abgänger verlassen die Abteilung', () => {
    const start = testSpiel(21);
    const vorEnde = simuliereWochen(start, 51);
    const kinderVorher = Object.values(vorEnde.kinder).filter((k) => k.status === 'aktiv');
    const nachher = simuliereWochen(vorEnde, 1);
    expect(nachher.saison).toBe(2);
    expect(nachher.woche).toBe(1);
    const bilanz = nachher.bilanzen[0]!;

    let erwarteteAbgaenger = 0;
    for (const k of kinderVorher) {
      const neu = nachher.kinder[k.id]!;
      if (alter(vorEnde, k) === 17) {
        erwarteteAbgaenger++;
        expect(neu.status).toBe('ausgetreten');
        expect(neu.austritt?.grund).toMatch(/U18/);
        continue;
      }
      if (neu.status !== 'aktiv') continue; // Austritt am Saisonende
      const stufe = stufeFuerAlter(alter(nachher, neu));
      expect(nachher.teams[neu.teamId!]!.stufe).toBe(stufe);
    }
    expect(bilanz.u18Abgaenger).toBe(erwarteteAbgaenger);
    expect(bilanz.uebertritte).toBeGreaterThan(0);
  });

  it('Das Spiel läuft bis zur gewählten Laufzeit weiter', () => {
    const s = simuliereWochen(testSpiel(22), 52);
    expect(s.spielende).toBeUndefined();
    expect(s.saison).toBe(2);
    expect(s.laufzeit).toBe(B.spiel.laufzeitStandard);
  });

  it('Nach Ablauf der Laufzeit endet das Spiel mit der Endbewertung', () => {
    const s = simuliereWochen(neuesSpiel({ vereinsname: 'SHC Test', seed: 23, laufzeit: 1 }), 52);
    expect(s.spielende?.grund).toBe('laufzeit');
    expect(s.spielende!.punkte).toBe(s.bilanzen[0]!.bewertung);
    expect(s.spielende!.endbewertung?.kriterien).toHaveLength(6);
  });
});

describe('Bewertung (Anzahl × Zufriedenheit)', () => {
  it('100 zufriedene Kinder schneiden besser ab als 150 unglückliche', () => {
    const zufrieden = bewertung(Array(100).fill(80));
    const ungluecklich = bewertung(Array(150).fill(40));
    expect(zufrieden).toBeGreaterThan(ungluecklich);
  });

  it('mehr Kinder bei gleicher Zufriedenheit geben mehr Punkte', () => {
    expect(bewertung(Array(60).fill(70))).toBeGreaterThan(bewertung(Array(40).fill(70)));
  });
});
