import { neuesSpiel } from '../neuesSpiel';
import { offenePflichtEreignisse } from '../ereignisse';
import { simulateWeek } from '../simulation';
import type { Entscheid, GameState } from '../types';

export function testSpiel(seed = 12345): GameState {
  return neuesSpiel({ vereinsname: 'SHC Test', seed, startJahr: 2026 });
}

/** Entscheidet alle offenen Pflicht-Ereignisse mit der ersten verfügbaren Option. */
export function pflichtEntscheide(state: GameState): Entscheid[] {
  return offenePflichtEreignisse(state).map((e) => ({ typ: 'ereignis', ereignisId: e.id, optionId: e.verfuegbareOptionen[0]! }));
}

export function simuliereWochen(state: GameState, n: number, extra: (s: GameState, i: number) => Entscheid[] = () => []): GameState {
  let s = state;
  for (let i = 0; i < n && !s.spielende; i++) {
    s = simulateWeek(s, [...pflichtEntscheide(s), ...extra(s, i)]).state;
  }
  return s;
}
