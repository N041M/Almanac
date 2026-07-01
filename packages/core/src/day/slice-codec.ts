/**
 * How a module (de)serializes and versions its slice of the local store
 * (design §11). Each slice is isolated: a corrupt or unknown-version payload
 * falls back to the module's default without touching any other slice (L5).
 */
export interface SliceCodec<T> {
  /** The module's storage namespace, e.g. "meals". */
  namespace: string;
  /** Schema version; bumped when the shape changes. */
  version: number;
  /** The value to use when nothing is stored, or on any failure (L5). */
  default: () => T;
  /**
   * Validate/parse a persisted payload into `T`. Throw (or the store falls back)
   * on anything unexpected — that's how one bad slice degrades in isolation.
   */
  decode(raw: unknown): T;
  encode(value: T): unknown;
}
