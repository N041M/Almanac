/** L4: all "now" flows through an injected clock — never `Date.now()` in logic. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}
