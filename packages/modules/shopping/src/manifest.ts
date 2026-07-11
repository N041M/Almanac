import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The shopping module's manifest. No day-slice codec: the list is derived from
 * the plan (the meals day slice) on demand, never stored (§8.1). Only the
 * schedule persists, under the module's own key (see `store.ts`).
 */
export const shoppingManifest: ModuleManifest = {
  id: 'shopping',
  messages: { en, cs },
};
