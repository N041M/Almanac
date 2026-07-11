import { useTranslation } from 'react-i18next';
import { CALENDAR_COLORS } from '../state/calendars';
import { Popover } from '../ui/Popover';

/** Theme-safe rendering of a calendar hue (fixed saturation/lightness). */
export function calendarColorCss(hue: number): string {
  return `hsl(${hue} 65% 50%)`;
}

/** A swatch button that opens the named Apple-style palette to recolor. */
export function ColorPicker({
  hue,
  onPick,
  label,
}: {
  hue: number;
  onPick: (hue: number) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <Popover
      label={label}
      align="left"
      trigger={
        <span
          className="block h-4 w-4 rounded-full"
          style={{ backgroundColor: calendarColorCss(hue) }}
        />
      }
    >
      {(close) => (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5 p-1">
          {CALENDAR_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              role="radio"
              aria-checked={hue === color.hue}
              aria-label={t(color.key)}
              title={t(color.key)}
              onClick={() => {
                onPick(color.hue);
                close();
              }}
              className={[
                'h-6 w-6 rounded-full border-2 focus-visible:outline-2 focus-visible:outline-accent',
                hue === color.hue ? 'border-ink' : 'border-transparent',
              ].join(' ')}
              style={{ backgroundColor: calendarColorCss(color.hue) }}
            />
          ))}
        </div>
      )}
    </Popover>
  );
}
