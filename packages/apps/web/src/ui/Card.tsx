import type { HTMLAttributes } from 'react';

/**
 * The one surface container. Calmer than the old inline pattern — a hairline
 * border and no drop shadow, leaning on whitespace for hierarchy (the first
 * step toward the lighter feel in docs/UX_VISION.md). Module UIs compose these
 * instead of repeating the border/padding classes inline.
 */
export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={['rounded-2xl border border-line bg-surface-raised p-4', className].join(' ')}
    />
  );
}
