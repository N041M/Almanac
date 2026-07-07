import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A lightweight anchored popover: a trigger button and a floating panel that
 * closes on outside-click or Escape. Used for the one-tap Calendars panel
 * (Apple-style) and reusable for any quick menu. Keyboard-dismissable and
 * focus-safe; no external positioning dep (the panel anchors to the trigger).
 */
export function Popover({
  label,
  trigger,
  triggerClassName = '',
  children,
  align = 'right',
}: {
  /** Accessible name for the trigger. */
  label: string;
  /** Visible trigger content. */
  trigger: ReactNode;
  triggerClassName?: string;
  /** Panel content; receives a `close` to dismiss from inside. */
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={[
          'rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent-soft/60',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
          triggerClassName,
        ].join(' ')}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={[
            'absolute z-40 mt-1 min-w-60 rounded-xl border border-line bg-surface-raised p-2 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
