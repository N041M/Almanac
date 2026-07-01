import type { Quantity } from './types.js';
import { getUnit } from './registry.js';

/**
 * Convert a quantity to another unit within the same dimension. Returns
 * `undefined` when either unit is unknown or the dimensions differ — the caller
 * treats that as "can't combine, keep separate" (L5), never a crash.
 */
export function convert(quantity: Quantity, toUnit: string): Quantity | undefined {
  const from = getUnit(quantity.unit);
  const to = getUnit(toUnit);
  if (from === undefined || to === undefined) return undefined;
  if (from.dimension !== to.dimension) return undefined;
  return { value: (quantity.value * from.toBase) / to.toBase, unit: toUnit };
}

/** Normalize to the dimension's base unit (g / ml / piece). `undefined` if unknown. */
export function normalize(quantity: Quantity): Quantity | undefined {
  const unit = getUnit(quantity.unit);
  if (unit === undefined) return undefined;
  const base = { mass: 'g', volume: 'ml', count: 'piece' }[unit.dimension];
  return convert(quantity, base);
}

/**
 * Combine two quantities if compatible, else keep them separate — the units
 * side of the shopping/aggregation degradation ladder (§8.1). Combines into the
 * unit of `a`. Unknown/incompatible units ⇒ both returned unchanged.
 */
export function tryCombine(a: Quantity, b: Quantity): Quantity[] {
  const bInA = convert(b, a.unit);
  if (bInA === undefined) return [a, b];
  return [{ value: a.value + bInA.value, unit: a.unit }];
}
