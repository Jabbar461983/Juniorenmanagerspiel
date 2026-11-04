// Verwaltung des Wochen-Entwurfs: Entscheide sammeln, Doppelte ersetzen.
import type { Entscheid } from '../engine';

/** Schlüssel, unter dem ein Entscheid einen früheren gleicher Art ersetzt (null = immer anhängen). */
export function entscheidSchluessel(e: Entscheid): string | null {
  switch (e.typ) {
    case 'trainingsplan':
      return `plan:${e.teamId}`;
    case 'beitrag':
      return `beitrag:${e.stufe}`;
    case 'geschwisterrabatt':
    case 'haertefallfonds':
    case 'material':
    case 'entschaedigung':
      return e.typ;
    case 'ereignis':
      return `ereignis:${e.ereignisId}`;
    case 'kindVerschieben':
      return `kind:${e.kindId}`;
    case 'dialog':
      return e.ereignisId ? `dialog-ereignis:${e.ereignisId}` : `dialog:${e.personId}`;
    case 'elternabend':
      return `elternabend:${e.teamId}`;
    case 'helferBeenden':
      return `helfer:${e.elternteilId}`;
    case 'sitzungVorbereiten':
      return 'vorbereiten';
    case 'sponsorSuche':
      return 'sponsorSuche';
    case 'aktivitaet':
      return `aktivitaet:${e.aktivitaetId}`;
    case 'antragZurueckziehen':
      return `zurueck:${e.antragId}`;
    default:
      return null;
  }
}

export function entscheidHinzufuegen(liste: Entscheid[], e: Entscheid): Entscheid[] {
  let basis = liste;
  // Neue Wahl bei einem Ereignis ersetzt auch ein zugehöriges Gespräch
  if (e.typ === 'ereignis') basis = basis.filter((x) => !(x.typ === 'dialog' && x.ereignisId === e.ereignisId));
  const key = entscheidSchluessel(e);
  if (key === null) return [...basis, e];
  return [...basis.filter((x) => entscheidSchluessel(x) !== key), e];
}

/** Anzahl geplanter Gespräche (ohne Gespräche aus Ereignissen) */
export function geplanteGespraeche(liste: Entscheid[]): number {
  return liste.filter((x) => x.typ === 'dialog' && !x.ereignisId).length;
}
