/* Deterministic seeded PRNG for demo fixtures.
 * Same seed => same data. Used to make demo mode stable across reloads.
 */
export function makeRng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let state = h || 1;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 0xffffffff;
    },
    int(min: number, max: number) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(this.next() * arr.length) % arr.length];
    },
    chance(p: number) {
      return this.next() < p;
    },
  };
}

export type Rng = ReturnType<typeof makeRng>;
