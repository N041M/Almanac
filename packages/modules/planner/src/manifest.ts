import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The planner module's manifest. No day-slice codecs and no store: it derives
 * suggestions on read from neutral inputs the app assembles; a confirmed
 * block becomes an ordinary tasks-module event, not planner state.
 */
export const plannerManifest: ModuleManifest = {
  id: 'planner',
  messages: { en, cs },
};
