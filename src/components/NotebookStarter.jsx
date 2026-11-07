import { useMemo } from 'react';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_SHADOW } from '../data/chalkTheme.js';
import { IngredientArt } from './chalkArt.jsx';
import { pickStarterIngredients } from '../data/notebookStarters.js';

/**
 * NotebookStarter — the friendly start for an empty Recipe Notebook
 * (DESIGN-4). Three starter ingredients drawn in chalk on the board; a tap
 * adds one to the bowl. Below them, a way into the Cookbook.
 */
export default function NotebookStarter({ nodes, onAdd, onOpenCookbook }) {
  const starters = useMemo(() => pickStarterIngredients(nodes, 3), [nodes]);

  return (
    <section
      data-testid="notebook-starter"
      aria-labelledby="notebook-starter-heading"
      className="mx-3 mt-1 mb-2 flex flex-col items-center"
    >
      <h2
        id="notebook-starter-heading"
        className="text-[26px] leading-tight"
        style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
      >
        Start with…
      </h2>
      {starters.length > 0 && (
        <ul className="mt-1 w-full grid grid-cols-3 gap-2" role="list">
          {starters.map(({ name, category }) => (
            <li key={name}>
              <button
                type="button"
                data-testid={`notebook-starter-${name}`}
                onClick={() => onAdd?.(name)}
                aria-label={`Add ${name} to the recipe`}
                className="w-full min-h-[96px] flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: `1.5px dashed ${CHALK_DIM}88`, outlineColor: CHALK_CREAM }}
              >
                <IngredientArt category={category} name={name} size={48} ink={CHALK_CREAM} />
                <span
                  className="block max-w-full px-1 text-[20px] leading-tight text-center break-words"
                  style={{ fontFamily: FONT, color: CHALK_CREAM, textShadow: CHALK_SHADOW }}
                >
                  {name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onOpenCookbook && (
        <button
          type="button"
          data-testid="notebook-starter-cookbook"
          onClick={onOpenCookbook}
          className="mt-2 min-h-[40px] px-3 text-[19px] underline underline-offset-4 rounded focus-visible:outline focus-visible:outline-2"
          style={{ fontFamily: FONT, color: CHALK_DIM, outlineColor: CHALK_CREAM, textDecorationColor: `${CHALK_SUB}` }}
        >
          or open a Cookbook recipe
        </button>
      )}
    </section>
  );
}
