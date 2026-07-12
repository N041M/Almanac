import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { WEATHER_NAMESPACE, weatherDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The weather module's manifest: its day-slice codec (the cached ambient
 * snapshot) and its i18n namespace. The app additionally registers a signal
 * provider so consumers read weather abstractly, never by import (§8, L1).
 */
export const weatherManifest: ModuleManifest = {
  id: WEATHER_NAMESPACE,
  codecs: [weatherDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
