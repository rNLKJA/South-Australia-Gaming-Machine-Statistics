/**
 * Seeded pseudo-random numbers (mulberry32). Every resampling result on the site states its seed,
 * and the same seed always reproduces the same interval, so the static pages are deterministic.
 */
export type Rng = () => number

/** The seed used across the Analysis pages: 1 July 2009, the first month of the series. */
export const DEFAULT_SEED = 20090701

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in [0, n). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}
