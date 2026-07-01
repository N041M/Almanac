/** Units combine only within a dimension; across dimensions they stay separate. */
export type Dimension = 'mass' | 'volume' | 'count';

export type MeasurementSystem = 'metric' | 'imperial';

export interface Unit {
  /** Canonical code, e.g. "g", "kg", "ml", "cup", "piece". */
  code: string;
  dimension: Dimension;
  /** Multiplier to the dimension's base unit (g for mass, ml for volume, 1 for count). */
  toBase: number;
  system?: MeasurementSystem;
}

export interface Quantity {
  value: number;
  /** A `Unit.code`. */
  unit: string;
}
