// Seed-basierter Zufallsgenerator (mulberry32). Der Zustand liegt im Spielstand
// (GameState.rngState), damit gleiche Spielstände gleiche Ergebnisse liefern.

export class Rng {
  constructor(public state: number) {
    this.state = state | 0;
  }

  /** Gleichverteilt in [0, 1) */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganzzahl in [min, max] (inklusive) */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Gleitkommazahl in [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() auf leerer Liste');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Auswahl nach Gewichten */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, it) => sum + Math.max(0, weight(it)), 0);
    if (items.length === 0) throw new Error('weighted() auf leerer Liste');
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weight(it));
      if (r < 0) return it;
    }
    return items[items.length - 1] as T;
  }

  /** Normalverteilung (Box-Muller) */
  normal(mean = 0, sd = 1): number {
    const u = 1 - this.next();
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Poisson-verteilte Zufallszahl (Knuth, für kleine Lambda) */
  poisson(lambda: number): number {
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l && k < 50);
    return k - 1;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
    }
    return arr;
  }
}

/** Erzeugt einen neuen Seed aus einer beliebigen Zahl (z.B. Zeitstempel) */
export function seedAus(wert: number): number {
  let h = 2166136261 ^ Math.floor(wert);
  h = Math.imul(h ^ (h >>> 13), 16777619);
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  return (h ^ (h >>> 15)) >>> 0;
}
