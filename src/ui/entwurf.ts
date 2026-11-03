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
    default:
      return null;
  }
}

export function entscheidHinzufuegen(liste: Entscheid[], e: Entscheid): Entscheid[] {
  const key = entscheidSchluessel(e);
  if (key === null) return [...liste, e];
  return [...liste.filter((x) => entscheidSchluessel(x) !== key), e];
}
