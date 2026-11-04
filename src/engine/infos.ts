// Verborgene Infos (Etappe 2): Was die Spieler:in über eine Person weiss.
// Infos werden aus dem Spielstand berechnet; `person.bekannt` hält fest, welche
// bereits offenbart wurden (durch Gespräche, Elternabende oder Beobachtung).
import { elternTyp, prioritaetName } from './config';
import { FAKTOR_NAMEN } from './zufriedenheit';
import type { Elternteil, GameState, Kind, Person, Trainer, Vorstandsmitglied, Zufriedenheitsfaktoren } from './types';

export interface Info {
  schluessel: string;
  titel: string;
  /** Text, wenn offenbart */
  text: string;
  bekannt: boolean;
}

function elternInfos(s: GameState, e: Elternteil): Omit<Info, 'bekannt'>[] {
  const f = s.familien[e.familieId];
  const res: Omit<Info, 'bekannt'>[] = [
    { schluessel: 'typ', titel: 'Elterntyp', text: `${elternTyp(e.typ).name}: ${elternTyp(e.typ).beschreibung}` }
  ];
  if (f?.einkommen === 'tief') {
    res.push({ schluessel: 'finanzielleSorgen', titel: 'Finanzen der Familie', text: 'Das Geld ist knapp. Beiträge und Material sind eine Belastung.' });
  }
  if (f?.getrennt) {
    res.push({ schluessel: 'getrennt', titel: 'Familiensituation', text: 'Die Eltern leben getrennt und sind sich nicht immer einig.' });
  }
  if (e.typ === 'potenziellerTrainer') {
    res.push({ schluessel: 'trainerwunsch', titel: 'Wunsch', text: 'Würde gern als Hilfsleiter:in mithelfen.' });
  }
  if (e.typ === 'abwesend') {
    res.push({ schluessel: 'schichtarbeit', titel: 'Alltag', text: 'Arbeitet unregelmässig, Fahrten an Spiele sind kaum möglich.' });
  }
  if (e.typ === 'ehrgeizig') {
    res.push({ schluessel: 'druckZuhause', titel: 'Erwartungen', text: 'Erwartet viel vom eigenen Kind und misst Erfolg an Einsatzzeit und Toren.' });
  }
  return res;
}

export function tiefsterFaktor(f: Zufriedenheitsfaktoren): keyof Zufriedenheitsfaktoren {
  return (Object.keys(f) as (keyof Zufriedenheitsfaktoren)[]).reduce((a, b) => (f[b] < f[a] ? b : a));
}

function kindInfos(s: GameState, k: Kind): Omit<Info, 'bekannt'>[] {
  const res: Omit<Info, 'bekannt'>[] = [];
  const t = k.werte.talent;
  res.push({ schluessel: 'talent', titel: 'Talent', text: t >= 15 ? 'gross' : t >= 9 ? 'mittel' : 'klein' });
  const tief = tiefsterFaktor(k.faktoren);
  res.push({
    schluessel: 'motivationsgrund',
    titel: 'Was beschäftigt',
    text: `Am meisten drückt: ${FAKTOR_NAMEN[tief]} (${Math.round(k.faktoren[tief])}).`
  });
  const f = s.familien[k.familieId];
  if (f && (f.getrennt || f.einkommen === 'tief')) {
    res.push({
      schluessel: 'zuhause',
      titel: 'Zu Hause',
      text: f.getrennt ? 'Pendelt zwischen zwei Haushalten, das ist manchmal anstrengend.' : 'Zu Hause ist das Geld knapp.'
    });
  }
  return res;
}

function trainerInfos(_s: GameState, t: Trainer): Omit<Info, 'bekannt'>[] {
  const res: Omit<Info, 'bekannt'>[] = [];
  if (t.motivation < 8 || t.belastung > 75) {
    res.push({ schluessel: 'ruecktrittsgedanken', titel: 'Gedanken', text: 'Denkt ernsthaft über einen Rücktritt nach.' });
  }
  if (t.charakterzuege.includes('vielbeschaeftigt')) {
    res.push({ schluessel: 'belastungZuhause', titel: 'Alltag', text: 'Job und Familie lassen kaum Luft. Mehr als ein Team liegt nicht drin.' });
  }
  return res;
}

function vorstandInfos(v: Vorstandsmitglied): Omit<Info, 'bekannt'>[] {
  return [{ schluessel: 'prioritaet', titel: 'Priorität im Verein', text: prioritaetName(v.prioritaet) }];
}

export function infosVon(s: GameState, p: Person): Info[] {
  const roh =
    p.rolle === 'elternteil' ? elternInfos(s, p) : p.rolle === 'kind' ? kindInfos(s, p) : p.rolle === 'trainer' ? trainerInfos(s, p) : vorstandInfos(p);
  return roh.map((i) => ({ ...i, bekannt: p.bekannt.includes(i.schluessel) }));
}

export function istBekannt(p: Person, schluessel: string): boolean {
  return p.bekannt.includes(schluessel);
}

export function offenbare(p: Person, schluessel: string): boolean {
  if (p.bekannt.includes(schluessel)) return false;
  p.bekannt.push(schluessel);
  return true;
}
