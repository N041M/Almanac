import type { Clock, StoragePort } from '@almanac/core';
import {
  DEFAULT_SHOPPING_SETTINGS,
  SHOPPING_SETTINGS_VERSION,
  decodeShoppingSettings,
  type ShoppingSettings,
} from './settings.js';

// The module's own (non-day) state: the shopping schedule under one key, a
// versioned envelope like every slice (§11). Reads never throw — a corrupt or
// unknown-version payload degrades to defaults in isolation (L5).

const SETTINGS_KEY = 'shopping:settings';

interface Envelope {
  v: number;
  d: unknown;
  m?: number;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

/**
 * The shopping module's persistence. The list itself is never stored — it is
 * derived from the plan on demand (§8.1). Only the schedule is durable.
 * Framework-free; the UI layer composes it.
 */
export interface ShoppingStore {
  getSettings(): Promise<ShoppingSettings>;
  saveSettings(settings: ShoppingSettings): Promise<void>;
}

export function createShoppingStore(storage: StoragePort, clock?: Clock): ShoppingStore {
  return {
    getSettings: async () => {
      let raw: string | null;
      try {
        raw = await storage.read(SETTINGS_KEY);
      } catch {
        return DEFAULT_SHOPPING_SETTINGS;
      }
      if (raw === null) return DEFAULT_SHOPPING_SETTINGS;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isEnvelope(parsed) || parsed.v !== SHOPPING_SETTINGS_VERSION) {
          return DEFAULT_SHOPPING_SETTINGS;
        }
        return decodeShoppingSettings(parsed.d);
      } catch {
        return DEFAULT_SHOPPING_SETTINGS;
      }
    },
    saveSettings: async (settings) => {
      const envelope: Envelope = {
        v: SHOPPING_SETTINGS_VERSION,
        d: settings,
        ...(clock !== undefined ? { m: clock.now() } : {}),
      };
      await storage.write(SETTINGS_KEY, JSON.stringify(envelope));
    },
  };
}
