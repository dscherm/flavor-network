const FONT_FAMILY = 'Caveat, cursive';

// 7-pill recipe-type row per RECIPE-LAB-SPEC §16. Single-select with
// re-tap to clear. Tapping a different pill replaces the previous
// selection. Pure presentational — state lives on RecipeLabMobile so
// the handoff watcher can hydrate / reset it.
export const RECIPE_TYPE_PILLS = [
  { key: 'main',      label: 'Main' },
  { key: 'side',      label: 'Side' },
  { key: 'appetizer', label: 'Appetizer' },
  { key: 'dessert',   label: 'Dessert' },
  { key: 'drink',     label: 'Drink' },
  { key: 'sauce',     label: 'Sauce' },
  { key: 'other',     label: 'Other' },
];

export default function RecipeTypePills({ value = null, onChange }) {
  return (
    <div
      className="mx-2 mb-1 flex flex-wrap items-center gap-1 p-1 rounded-lg border border-[#d8cca8] bg-[#fefae0]"
      role="radiogroup"
      aria-label="Recipe type"
      data-testid="recipe-type-pills"
    >
      {RECIPE_TYPE_PILLS.map((p) => {
        const isChecked = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={isChecked}
            data-testid={`recipe-type-pill-${p.key}`}
            onClick={() => onChange?.(isChecked ? null : p.key)}
            className={`min-h-[44px] px-3 py-1 text-sm rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5a4a2a]/60 ${
              isChecked
                ? 'bg-[#e8dcc0] border-[#c9b99a] text-[#5a4a2a] font-medium'
                : 'border-transparent text-[#a09070] hover:bg-[#f0e8d0]'
            }`}
            style={{ fontFamily: FONT_FAMILY }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
