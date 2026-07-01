/**
 * Opt-in cross-device sync seam (decision D1, design §11). Reserved: the app is
 * fully functional single-device and sync only ever *adds* convenience (L5/L6).
 * Health/sensitive slices must be opt-in + encrypted before leaving the device.
 * Kept minimal until the sync phase; storage slices are already versioned so
 * they're sync-ready.
 */
export interface SyncRecord {
  key: string;
  value: string;
  /** Monotonic revision for last-writer / conflict reconciliation. */
  revision: number;
}

export interface SyncPort {
  push(record: SyncRecord): Promise<void>;
  pull(sinceRevision: number): Promise<SyncRecord[]>;
}
