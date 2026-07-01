/**
 * The single intensity scale the calendar owns (design §5), so priority reads
 * consistently across every module: P1 solid, P2 ~30% faded, P3 ~60% faded.
 * Absent priority → full intensity (L5).
 */
export type Priority = 1 | 2 | 3;

export function intensityForPriority(priority: Priority | undefined): number {
  switch (priority) {
    case 2:
      return 0.7;
    case 3:
      return 0.4;
    default:
      return 1; // P1 or absent
  }
}
