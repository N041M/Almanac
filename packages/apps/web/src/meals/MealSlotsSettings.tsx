import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeals } from '../state/meals';
import { slotLabel } from '../state/meal-slot-label';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * The meal-slot configuration: how many meals a day and what they're called
 * (default Breakfast/Lunch/Dinner). Renaming a built-in slot replaces its
 * localized name with the user's. At least one slot always remains.
 */
export function MealSlotsSettings() {
  const { t } = useTranslation('meals');
  const slots = useMeals((s) => s.slots);
  const setSlots = useMeals((s) => s.setSlots);
  const [name, setName] = useState('');

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-ink-muted">{t('mealSlots')}</h3>
      <ul className="space-y-1.5">
        {slots.map((slot) => (
          <li key={slot.id} className="flex items-center gap-2 text-sm">
            <Input
              aria-label={t('slotName')}
              value={slotLabel(slot, t)}
              onChange={(e) =>
                void setSlots(
                  slots.map((s) => (s.id === slot.id ? { ...s, name: e.target.value } : s)),
                )
              }
              className="min-w-32 flex-1"
            />
            <Button
              variant="ghost"
              aria-label={t('removeSlot', { name: slotLabel(slot, t) })}
              onClick={() => void setSlots(slots.filter((s) => s.id !== slot.id))}
              disabled={slots.length <= 1}
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = name.trim();
          if (trimmed === '') return; // empty add: a quiet no-op (L5)
          void setSlots([...slots, { id: crypto.randomUUID(), name: trimmed }]);
          setName('');
        }}
      >
        <Input
          aria-label={t('addSlot')}
          placeholder={t('slotName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">{t('addSlot')}</Button>
      </form>
    </div>
  );
}
