import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { allUnits } from '@almanac/core';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';

/**
 * The ingredient lines of one meal: list + remove, an add row (name, amount,
 * unit from the core registry), and servings. Ingredient names resolve
 * through the shared catalog; an unknown id degrades to the id text (L5).
 */
export function MealIngredientsEditor({ recipeId }: { recipeId: string }) {
  const { t } = useTranslation('meals');
  const recipe = useMeals((s) => s.recipes[recipeId]);
  const ingredients = useMeals((s) => s.ingredients);
  const addIngredient = useMeals((s) => s.addIngredient);
  const removeIngredient = useMeals((s) => s.removeIngredient);
  const setServings = useMeals((s) => s.setServings);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('g');

  if (recipe === undefined) return null;

  const submit = () => {
    const value = Number(amount);
    if (name.trim() === '' || !Number.isFinite(value) || value <= 0) return;
    void addIngredient(recipeId, name, value, unit);
    setName('');
    setAmount('');
  };

  const inputClass =
    'rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent';

  return (
    <div className="mt-2 space-y-3 rounded-xl border border-line bg-surface px-3 py-3">
      {recipe.ingredients.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('noIngredientsYet')}</p>
      ) : (
        <ul className="space-y-1">
          {recipe.ingredients.map((line, i) => {
            const lineName = ingredients[line.ingredientId]?.name ?? line.ingredientId;
            return (
              <li key={`${line.ingredientId}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{lineName}</span>
                <span className="text-ink-muted">
                  {line.quantity.value} {line.quantity.unit}
                </span>
                <Button
                  variant="ghost"
                  aria-label={t('removeLine', { name: lineName })}
                  onClick={() => void removeIngredient(recipeId, i)}
                >
                  {t('remove')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          aria-label={t('ingredientName')}
          placeholder={t('ingredientName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`min-w-32 flex-1 ${inputClass}`}
        />
        <input
          aria-label={t('amount')}
          placeholder={t('amount')}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`w-20 ${inputClass}`}
        />
        <select
          aria-label={t('unit')}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className={inputClass}
        >
          {allUnits().map((u) => (
            <option key={u.code} value={u.code}>
              {u.code}
            </option>
          ))}
        </select>
        <Button type="submit">{t('addIngredient')}</Button>
      </form>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        {t('servings')}
        <input
          aria-label={t('servings')}
          type="number"
          min={1}
          value={recipe.servings}
          onChange={(e) => void setServings(recipeId, Number(e.target.value))}
          className={`w-16 ${inputClass}`}
        />
      </label>
    </div>
  );
}
