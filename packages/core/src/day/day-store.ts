import type { ISODate } from '../time/iso-date.js';
import type { StoragePort } from '../ports/storage.js';
import type { SliceCodec } from './slice-codec.js';
import type { Day } from './day.js';
import { emptyDay, withSlice } from './day.js';
import { addDays, diffDays } from '../time/date-math.js';

/**
 * Reads/writes Days as isolated, versioned per-module slices (design §5/§11).
 * The load-bearing L5 guarantee: `readSlice` **never throws** — a missing,
 * corrupt, or unknown-version payload degrades to the module's default, and one
 * bad slice never takes down another slice, the Day, or the app.
 */
export interface DayStore {
  readSlice<T>(date: ISODate, codec: SliceCodec<T>): Promise<T>;
  writeSlice<T>(date: ISODate, codec: SliceCodec<T>, value: T): Promise<void>;
  /** Assemble a Day from the given module codecs (each slice read in isolation). */
  getDay(date: ISODate, codecs: ReadonlyArray<SliceCodec<unknown>>): Promise<Day>;
  getRange(
    start: ISODate,
    end: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day[]>;
}

function sliceKey(date: ISODate, namespace: string): string {
  return `day:${date}:${namespace}`;
}

interface Envelope {
  v: number;
  d: unknown;
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && 'v' in value && 'd' in value;
}

export function createDayStore(storage: StoragePort): DayStore {
  async function readSlice<T>(date: ISODate, codec: SliceCodec<T>): Promise<T> {
    let raw: string | null;
    try {
      raw = await storage.read(sliceKey(date, codec.namespace));
    } catch {
      return codec.default(); // storage read failure → default (L5)
    }
    if (raw === null) return codec.default();
    try {
      const parsed: unknown = JSON.parse(raw);
      // Unknown/other version → default (isolation; migrations come later, §11).
      if (!isEnvelope(parsed) || parsed.v !== codec.version) return codec.default();
      return codec.decode(parsed.d);
    } catch {
      return codec.default(); // corrupt payload or decode error → default (L5)
    }
  }

  async function writeSlice<T>(
    date: ISODate,
    codec: SliceCodec<T>,
    value: T,
  ): Promise<void> {
    const envelope: Envelope = { v: codec.version, d: codec.encode(value) };
    await storage.write(sliceKey(date, codec.namespace), JSON.stringify(envelope));
  }

  async function getDay(
    date: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day> {
    let day = emptyDay(date);
    for (const codec of codecs) {
      day = withSlice(day, codec.namespace, await readSlice(date, codec));
    }
    return day;
  }

  async function getRange(
    start: ISODate,
    end: ISODate,
    codecs: ReadonlyArray<SliceCodec<unknown>>,
  ): Promise<Day[]> {
    const days: Day[] = [];
    for (let i = 0; i <= diffDays(start, end); i++) {
      days.push(await getDay(addDays(start, i), codecs));
    }
    return days;
  }

  return { readSlice, writeSlice, getDay, getRange };
}
