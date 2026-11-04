// Geldbeschaffung (Etappe 3): Aktivitäten mit Vorbereitung, Helfer:innen, Ertrag und Risiko.
import { B, aktivitaetDef, type AktivitaetDef } from './config';
import { buchen } from './finanzen';
import { absoluteWoche, aktuelleWoche } from './kalender';
import { aktiveKinder, name } from './personen';
import type { Rng } from './rng';
import type { Buchung, Elternteil, GameState, LaufendeAktivitaet } from './types';
import { clamp, neueId } from './util';
import { chronik } from './vorstand';

/** Helfer-Pool: Eltern mit Rolle «Anlässe», dann engagierte Eltern aktiver Kinder */
export function helferPool(state: GameState): Elternteil[] {
  const aktiveFamilien = new Set(aktiveKinder(state).map((k) => k.familieId));
  return Object.values(state.eltern)
    .filter((e) => aktiveFamilien.has(e.familieId) && (e.helfer === 'anlaesse' || e.engagement >= B.anlaesse.poolEngagementAb))
    .sort((a, b) => Number(b.helfer === 'anlaesse') - Number(a.helfer === 'anlaesse') || a.auslastung - b.auslastung || a.id.localeCompare(b.id));
}

export function aktivitaetMoeglich(state: GameState, def: AktivitaetDef): string | null {
  const phase = aktuelleWoche(state).phase;
  if (def.phasen.length > 0 && !def.phasen.includes(phase)) return 'Passt in dieser Phase der Saison nicht.';
  if (state.aktivitaeten.some((a) => a.aktivitaetId === def.id && a.status === 'laufend')) return 'Läuft bereits.';
  return null;
}

export function aktivitaetStarten(state: GameState, def: AktivitaetDef, buchungen: Buchung[], meldungen: string[]): LaufendeAktivitaet {
  const pool = helferPool(state);
  const helfer = pool.slice(0, def.helfer).map((e) => e.id);
  if (def.kosten > 0) buchen(state, { kategorie: 'anlaesse', text: `Vorbereitung ${def.name}`, betrag: -def.kosten }, buchungen);
  const a: LaufendeAktivitaet = {
    id: neueId(state, 'akt'),
    aktivitaetId: def.id,
    saison: state.saison,
    startWoche: state.woche,
    abschluss: absoluteWoche(state) + def.vorbereitung,
    helferIds: helfer,
    status: 'laufend'
  };
  state.aktivitaeten.push(a);
  if (state.vorstand.konkursStufe >= 1) state.vorstand.rettungsplan = true;
  meldungen.push(
    `${def.name} ist in Vorbereitung (${def.vorbereitung} Woche${def.vorbereitung === 1 ? '' : 'n'})` +
      (def.helfer > 0 ? `, ${helfer.length} von ${def.helfer} Helfer:innen gefunden.` : '.')
  );
  return a;
}

/** Wöchentlich: fällige Aktivitäten durchführen. */
export function anlaesseWoche(state: GameState, rng: Rng, buchungen: Buchung[], meldungen: string[]): void {
  const A = B.anlaesse;
  const jetzt = absoluteWoche(state);
  const laufend = state.aktivitaeten.filter((a) => a.status === 'laufend');
  for (const a of laufend) {
    if (a.abschluss > jetzt) continue;
    const def = aktivitaetDef(a.aktivitaetId);
    const [min, max] = def.ertrag as [number, number];
    let ertrag = rng.int(min, max);
    if (def.proKind) ertrag *= aktiveKinder(state).length / 50;
    if (def.proReichweite) ertrag *= state.social.reichweite;
    if (def.rufAbhaengig) ertrag *= 0.5 + state.verein.ruf / 100;
    let text = '';
    if (def.gesuch) {
      const erfolg = rng.chance(clamp(0.3 + state.verein.ruf / 200, 0.1, 0.9));
      if (!erfolg) {
        ertrag = 0;
        text = 'Das Gesuch wurde abgelehnt.';
      } else text = 'Das Gesuch wurde bewilligt.';
    }
    if (def.helfer > 0) {
      const anteil = Math.min(1, a.helferIds.length / def.helfer);
      if (anteil < 1) text += ` Es fehlten Helfer:innen (${a.helferIds.length}/${def.helfer}).`;
      ertrag *= 0.4 + 0.6 * anteil;
    }
    if (def.risiko && rng.chance(def.risiko.wahrscheinlichkeit)) {
      ertrag *= def.risiko.ertragFaktor;
      text += ` ${def.risiko.text}.`;
    }
    ertrag = Math.round(ertrag / 10) * 10;
    // Helfer:innen: Auslastung, Überlastung bei parallelen Anlässen
    const parallel = new Set(laufend.filter((x) => x.id !== a.id).flatMap((x) => x.helferIds));
    const ueberlastet: string[] = [];
    for (const id of a.helferIds) {
      const e = state.eltern[id];
      if (!e) continue;
      if (parallel.has(id)) {
        e.auslastung = clamp(e.auslastung + A.ueberlastungAuslastung, 0, 100);
        e.stimmung = clamp(e.stimmung + A.ueberlastungStimmung, 0, 100);
        ueberlastet.push(name(e));
      } else {
        e.auslastung = clamp(e.auslastung + A.helferAuslastung, 0, 100);
        if (ertrag > 0) e.stimmung = clamp(e.stimmung + A.erfolgStimmung, 0, 100);
      }
      e.engagement = clamp(e.engagement + 0.5, 1, 20);
    }
    if (ueberlastet.length > 0) text += ` Überlastet, weil gleichzeitig ein anderer Anlass läuft: ${ueberlastet.join(', ')}.`;
    if (ertrag > 0) {
      buchen(state, { kategorie: 'anlaesse', text: def.name, betrag: ertrag }, buchungen);
      state.verein.ruf = clamp(state.verein.ruf + def.ruf, 0, 100);
      if (def.kinderZufriedenheit) for (const k of aktiveKinder(state)) k.offeneEffekte += def.kinderZufriedenheit;
    }
    a.status = 'abgeschlossen';
    a.ertrag = ertrag;
    a.text = `${def.name}: CHF ${ertrag}.${text}`.trim();
    meldungen.push(a.text);
    if (ertrag >= 2000) chronik(state, 'finanzen', `${def.name} bringt CHF ${ertrag}.`);
  }
  if (state.aktivitaeten.length > 60) state.aktivitaeten = state.aktivitaeten.slice(-60);
}
