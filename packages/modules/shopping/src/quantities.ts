import { normalize, tryCombine, type Quantity } from '@almanac/core';

/**
 * Fold a quantity into a running bucket list: merge it with the first
 * compatible bucket (same dimension, unit-converted), else keep it separate.
 * This is the units side of the §8.1 aggregation ladder — compatible quantities
 * combine, incompatible ones ("2 onions" + "200 g onion") stay listed apart
 * rather than being forced or dropped (L5). Non-finite values are skipped by the
 * caller before they reach here.
 *
 * Known units are normalized to their dimension's base (g / ml / piece) first,
 * so output is canonical and deterministic regardless of the order recipes were
 * entered in — the same posture as the food kernel's nutrition derivation. An
 * unknown unit keeps its own value and simply never merges (L5).
 */
export function addQuantity(buckets: readonly Quantity[], q: Quantity): Quantity[] {
  const normalized = normalize(q) ?? q;
  const next: Quantity[] = [];
  let merged = false;
  for (const bucket of buckets) {
    if (!merged) {
      const combined = tryCombine(bucket, normalized);
      // tryCombine returns one entry when compatible, two when it kept them apart.
      if (combined.length === 1 && combined[0] !== undefined) {
        next.push(combined[0]);
        merged = true;
        continue;
      }
    }
    next.push(bucket);
  }
  if (!merged) next.push(normalized);
  return next;
}
