import type { Rng } from '../ports/rng.js';

/**
 * A seedable, deterministic PRNG (mulberry32) — the L4 randomness seam. Same
 * seed ⇒ same stream, which is what makes the meal engine's probabilistic draws
 * reproducible and testable (design §6, §12). `Math.imul` here is arithmetic,
 * not randomness — the only entropy is the seed.
 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
