// Endbewertung (Etappe 3): gewichtete Kriterien nach Spielkonzept, je 0–100.
import { B } from './config';
import { alter } from './personen';
import { aktiveKinder, durchschnittZufriedenheit, teamTrainer } from './personen';
import type { Endbewertung, GameState } from './types';
import { clamp } from './util';

export function juniorenWert(anzahl: number): number {
  return 100 * (1 - Math.exp(-anzahl / B.bewertung.juniorenSkala));
}

export function trainerWert(state: GameState): number {
  const teams = Object.values(state.teams);
  if (teams.length === 0) return 0;
  let summe = 0;
  for (const t of teams) {
    const trainer = teamTrainer(state, t);
    const anzahl = Math.min(trainer.length, 3) / 3;
    const alterListe = trainer.map((x) => alter(state, x));
    const generationen = alterListe.some((a) => a > 40) && alterListe.some((a) => a < 26) ? 1 : 0;
    const geschlechter = new Set(trainer.map((x) => x.geschlecht)).size > 1 ? 1 : 0;
    const quali = trainer.length ? trainer.filter((x) => x.qualifikation !== 'keine').length / trainer.length : 0;
    summe += anzahl * 45 + generationen * 15 + geschlechter * 15 + quali * 25;
  }
  return clamp(summe / teams.length, 0, 100);
}

export function finanzWert(kasse: number): number {
  return kasse >= 0 ? clamp(50 + kasse / 200, 50, 100) : clamp(50 + kasse / 100, 0, 50);
}

export function bewertungsTitel(punkte: number): string {
  for (const t of B.bewertung.titel) if (punkte >= t.ab) return t.titel;
  return B.bewertung.titel[B.bewertung.titel.length - 1]!.titel;
}

/** Bewertung aus Anzahl, Zufriedenheit und weiteren Kriterien (0–100 Punkte). */
export function endbewertung(state: GameState): Endbewertung {
  const G = B.bewertung.gewichte;
  const kriterien = [
    { id: 'junioren', name: 'Aktive Junior:innen', gewicht: G.junioren, wert: juniorenWert(aktiveKinder(state).length) },
    { id: 'zufriedenheit', name: 'Durchschnittliche Zufriedenheit', gewicht: G.zufriedenheit, wert: durchschnittZufriedenheit(state) },
    { id: 'rufEinfluss', name: 'Ruf und Vorstandseinfluss', gewicht: G.rufEinfluss, wert: (state.verein.ruf + state.verein.vorstandEinfluss) / 2 },
    { id: 'trainer', name: 'Trainerstruktur', gewicht: G.trainer, wert: trainerWert(state) },
    { id: 'heikleFaelle', name: 'Umgang mit heiklen Fällen', gewicht: G.heikleFaelle, wert: B.bewertung.heikleFaelleNeutral },
    { id: 'finanzen', name: 'Finanzen', gewicht: G.finanzen, wert: finanzWert(state.finanzen.kasse) }
  ].map((k) => ({ ...k, wert: Math.round(k.wert * 10) / 10 }));
  const punkte = Math.round(kriterien.reduce((s, k) => s + k.gewicht * k.wert, 0) * 10) / 10;
  return { punkte, titel: bewertungsTitel(punkte), kriterien };
}

/** Vereinfachte Bewertung nur aus Anzahl und Zufriedenheit (für Vergleiche). */
export function kernbewertung(anzahl: number, zufriedenheit: number): number {
  const G = B.bewertung.gewichte;
  return (G.junioren * juniorenWert(anzahl) + G.zufriedenheit * zufriedenheit) / (G.junioren + G.zufriedenheit);
}
