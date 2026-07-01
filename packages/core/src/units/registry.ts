import type { Unit } from './types.js';

// Base units per dimension: mass → g, volume → ml, count → piece.
const UNITS: readonly Unit[] = [
  { code: 'mg', dimension: 'mass', toBase: 0.001, system: 'metric' },
  { code: 'g', dimension: 'mass', toBase: 1, system: 'metric' },
  { code: 'kg', dimension: 'mass', toBase: 1000, system: 'metric' },
  { code: 'oz', dimension: 'mass', toBase: 28.349523125, system: 'imperial' },
  { code: 'lb', dimension: 'mass', toBase: 453.59237, system: 'imperial' },

  { code: 'ml', dimension: 'volume', toBase: 1, system: 'metric' },
  { code: 'l', dimension: 'volume', toBase: 1000, system: 'metric' },
  { code: 'tsp', dimension: 'volume', toBase: 4.92892159375, system: 'imperial' },
  { code: 'tbsp', dimension: 'volume', toBase: 14.78676478125, system: 'imperial' },
  { code: 'cup', dimension: 'volume', toBase: 236.5882365, system: 'imperial' },

  { code: 'piece', dimension: 'count', toBase: 1 },
];

const BY_CODE = new Map<string, Unit>(UNITS.map((u) => [u.code, u]));

/** The unit for a code, or `undefined` if unknown (callers degrade, L5). */
export function getUnit(code: string): Unit | undefined {
  return BY_CODE.get(code);
}

export function allUnits(): readonly Unit[] {
  return UNITS;
}
