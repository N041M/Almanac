// @almanac/shopping — the two-trigger shopping-list generator (§8.1). One
// aggregation engine, two entry points (scheduled trips / "shopping now").
// Depends on @almanac/core and @almanac/food only — never the meals module (L1):
// it reads the planned recipe off the shared Day record, not by import. Pure and
// deterministic (L3/L4); the list is derived on demand, never stored.

export type { ShoppingLine, ShoppingGroup, ShoppingList } from './types.js';
export { OTHER_AISLE } from './types.js';
export { addQuantity } from './quantities.js';
export type { ShoppingWindow } from './window.js';
export {
  DEFAULT_HORIZON_DAYS,
  nextShoppingDay,
  shoppingNowWindow,
  scheduledWindows,
} from './window.js';
export type { ShoppingLookups } from './aggregate.js';
export { aggregateWindow } from './aggregate.js';
export type { ShoppingSettings } from './settings.js';
export {
  DEFAULT_SHOPPING_SETTINGS,
  SHOPPING_SETTINGS_VERSION,
  decodeRecurrence,
  decodeShoppingSettings,
} from './settings.js';
export type { ShoppingStore } from './store.js';
export { createShoppingStore } from './store.js';
export { shoppingManifest } from './manifest.js';

export const SHOPPING_MODULE_VERSION = '0.0.0';
