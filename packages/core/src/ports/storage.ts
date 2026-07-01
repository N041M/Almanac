/**
 * Local persistence seam (L6). String in / string out so any backend fits —
 * IndexedDB, localStorage, the mobile platform store. Serialization and
 * schema-versioning live above this, in the day-store's slice codecs, so a
 * corrupt or unknown-version slice degrades in isolation (L5).
 *
 * Adapters live in apps; the core only defines the contract (L3).
 */
export interface StoragePort {
  /** Returns the stored string, or `null` if the key is absent. */
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Keys currently stored, optionally filtered by prefix. */
  keys(prefix?: string): Promise<string[]>;
}
