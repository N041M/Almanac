import type { ModuleManifest } from '@almanac/core';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The insights module's manifest. No day-slice codecs and no store: insights
 * derives everything on read from what other modules already recorded — it
 * owns analytics, never data (§8).
 */
export const insightsManifest: ModuleManifest = {
  id: 'insights',
  messages: { en, cs },
};
