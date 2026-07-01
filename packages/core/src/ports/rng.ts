/** L4: all randomness flows through an injected Rng — never `Math.random()`. */
export interface Rng {
  /** A float in [0, 1). */
  (): number;
}
