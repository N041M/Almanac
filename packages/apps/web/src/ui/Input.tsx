import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

/** Shared control styling — one place to restyle every text field / select. */
export const controlClass =
  'rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink ' +
  'placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={[controlClass, className].join(' ')} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={[controlClass, className].join(' ')}>
      {children}
    </select>
  );
}

/** A labelled control column — the small "caption over field" pattern. */
export function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={['flex flex-col gap-1 text-xs text-ink-muted', className].join(' ')}>
      {label}
      {children}
    </label>
  );
}
