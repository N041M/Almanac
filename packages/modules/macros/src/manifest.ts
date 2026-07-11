import type { ModuleManifest, SliceCodec } from '@almanac/core';
import { MACROS_NAMESPACE, macrosDayCodec } from './slice.js';
import { en } from './i18n/en.js';
import { cs } from './i18n/cs.js';

/**
 * The macros module's manifest: its day-slice codec (the intake log the day
 * record carries) and its i18n namespace. The planned meal's macros derive on
 * read, so only the log persists (§8).
 */
export const macrosManifest: ModuleManifest = {
  id: MACROS_NAMESPACE,
  codecs: [macrosDayCodec as SliceCodec<unknown>],
  messages: { en, cs },
};
