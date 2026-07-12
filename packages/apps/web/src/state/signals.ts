import { createSignalRegistry } from '@almanac/core';

/**
 * The app's one context-signal registry (§5): providers register here (e.g.
 * weather), consumers read abstractly and never import the producing module
 * (L1). No provider ⇒ `get` returns undefined — a normal state (L5).
 */
export const signals = createSignalRegistry();
