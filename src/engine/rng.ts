// mulberry32: aleatorio con semilla, para que la escena sea siempre la misma.
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }

  next(): number {
    let t = (this.s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number { return Math.floor(this.next() * n); }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
}
