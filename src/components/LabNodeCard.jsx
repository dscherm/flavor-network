/**
 * LabNodeCard — full-screen "card mode" for a Cocktail Lab or Sauce Lab
 * node, in the same charcoal/chalk aesthetic as AlphaModeDetailsCard.
 *
 * Opens when a sauce/cocktail node is tapped. Shows, top→bottom:
 *   - name (big, chalk-outlined)
 *   - family line (drawn glass or vessel + family name in its colour) and a sub-group line
 *   - prep details row (glass / build / ice / cuisine …)
 *   - ingredient list
 *   - preparation text
 *   - "{Cocktails|Sauces} like this" chips (within-family cousins)
 *   - "Cousins in other families" chips (cross-family cousins)
 *   - optional "Pairs with" chips
 *
 * Every section hides itself when it has no data, so the same component
 * serves both labs (cocktails carry glass/build/bridges; sauces carry
 * cuisine/technique/pairsWith).
 */

import React, { useEffect } from 'react';
import { liftColor } from '../data/drinkColor.js';
import { TEXT, HAND, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';
import { textAction, FOCUS, ACCENT } from './inventUi.jsx';
import { ShareButton } from './ShareSheet.jsx';
import { OwnShareButton } from './OwnShare.jsx';
import { ChevronLeft, ChevronDown, chalkRule } from './ChalkIcons.jsx';
import { SHARE_OWN_ENABLED } from '../data/shareTargets.js';
import { IngredientName } from './IngredientCardProvider.jsx';
import { FlavorProfileButton, FlavorProfileSection, useFlavorToggle } from './RecipeFlavorProfile.jsx';

const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

const FS_NAME = 'clamp(34px, 6vh, 60px)';
const FS_SECTION = 22;
// Ingredients + preparation are the heart of the card — set noticeably larger
// than the cousin/bridge chips (FS_CHIP) so they read first.
const FS_BODY = 'clamp(19px, 2.7vh, 27px)';
const FS_CHIP = 'clamp(14px, 2vh, 20px)';
const FS_MEASURE = 'clamp(15px, 1.9vh, 19px)';
const FS_SUB = 'clamp(11px, 1.5vh, 15px)';

// Split a free-text preparation into steps. Priority: explicit line breaks →
// pre-existing numbered markers ("1. … 2. …") → sentence boundaries. Any
// leading enumerator is stripped so our own numbering never doubles up
// (recipes that already carry numbers won't render "1. 1. …"). Returns ≥2
// entries only when the text really is multi-step.
function splitPrepSteps(text) {
  const t = String(text).trim();
  let parts = t.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1 && /(?:^|\s)\d+[.)]\s+/.test(t)) {
    parts = t.split(/\s*\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean);
  }
  if (parts.length <= 1) {
    parts = t.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
  }
  return parts.map((s) => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
}

// Space, not boxes: 40 px between sections of a reading surface, 12 px from a heading to its content.
function SectionLabel({ children, color = CHALK_CREAM }) {
  return (
    <h3 style={{ color, fontFamily: HAND, fontSize: FS_SECTION, fontWeight: 400, marginTop: 40, marginBottom: 12, textShadow: CHALK_TEXT_SHADOW }}>
      {children}
    </h3>
  );
}

// A name that opens something: the dotted underline the app uses for ingredient names. No dot, no box.
const LINK_STYLE = {
  color: CHALK_CREAM, background: 'none', border: 'none', padding: 0, fontFamily: TEXT, fontSize: FS_CHIP, textAlign: 'left',
  textDecoration: 'underline dotted', textDecorationColor: 'rgba(245,239,222,0.5)', textUnderlineOffset: 4, minHeight: 44,
};

// A plain list of names (like-this / bridges / pairs-with): each one opens something.
function NameList({ items, onSelect, showFamily = false, testid, ingredients = false, columns = true }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className={columns ? 'grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0' : 'flex flex-col gap-3'} data-testid={testid}>
      {items.map((it, i) => {
        const name = typeof it === 'string' ? it : it.name;
        const fam = showFamily && typeof it === 'object' ? it.family_name : null;
        const chipId = `labcard-chip-${String(name).toLowerCase().replace(/\s+/g, '-')}`;
        return (
          <li key={`${name}-${i}`} className="min-w-0">
            {ingredients ? (
              <IngredientName name={name} loose tall testid={chipId} style={{ fontFamily: TEXT, fontSize: FS_CHIP }}>{name}</IngredientName>
            ) : (
              <button type="button" onClick={onSelect ? () => onSelect(name) : undefined} data-testid={chipId}
                className={`inline-flex flex-col items-start justify-center max-w-full ${FOCUS}`}
                style={{ ...LINK_STYLE, cursor: onSelect ? 'pointer' : 'default' }}>
                <span className="max-w-full">{name}</span>
                {fam ? <span style={{ color: CHALK_SUB, fontFamily: TEXT, fontSize: 13, textDecoration: 'none' }}>{fam}</span> : null}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function LabNodeCard({
  kind = 'cocktail',
  name,
  clusterName,
  clusterColor = '#9a8f7a',
  clusterTag,
  clusterArt = null,     // drawn glass / vessel beside the family name
  yours = false,         // the cook's own item: a small "Yours" after the sub-group line
  details = [],          // [{ label, value }]
  ingredients = [],      // string[] | [{ name, measure }]
  prep,                  // string
  ingredientsLabel = 'Ingredients',
  prepLabel = null,      // wine passes "Tasting notes"; cocktail and sauce steps carry no heading
  afterIngredients = null, // e.g. What do I need?, directly under the ingredient list
  afterMethod = null,    // e.g. About this drink, Serve it with: below the method
  ingredientsNote = null, // small print under the ingredient list (the "~" legend)
  likeThis = [],         // [{ name, similarity, color }]
  bridges = [],          // [{ name, family_name, color }]
  pairsWith = [],        // string[]
  actions = [],          // [{ label, onClick, testid }] — text controls under the family line
  share = null,          // { link, recipe } for a built-in recipe: adds a Share control to the actions row
  ownShare = null,       // { kind, item } for a recipe the cook made: a Share control that publishes it first (SHARE_OWN_ENABLED)
  flavor = null,         // { recipe, nodes, builtIn, onProfileOpen } PROFILE-1: a "Flavor profile" control beside the actions, opening the profile in place
  children = null,       // optional extra sections, rendered after the details row
  headerArt = null,      // optional decorative drawing above the name (e.g. the wine's glass)
  onSelect,
  onClose,
}) {
  const flavorToggle = useFlavorToggle(() => flavor?.onProfileOpen?.(flavor.recipe?.kind, !!flavor.builtIn));
  // A different card (a cousin chip) starts with the profile closed.
  useEffect(() => { if (flavorToggle.open) flavorToggle.close(); }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cleanDetails = (details || []).filter((d) => d && d.value);
  const ingList = (ingredients || []).map((ing) =>
    typeof ing === 'string' ? { name: ing, measure: '' } : { name: ing?.name, measure: ing?.measure || '' },
  ).filter((ing) => ing.name);
  const likeThisLabel = { sauce: 'Sauces like this', wine: 'Wines like this' }[kind] || 'Cocktails like this';
  const actionStyle = { ...textAction({ fontSize: FS_CHIP }), textShadow: CHALK_TEXT_SHADOW };

  return (
    <div className="chalk-board fixed inset-x-0 top-0 safe-top-pad z-[80] flex flex-col items-center px-4 py-3 overflow-y-auto"
      // v1.0.2: bottom stops above the fixed tab bar — inset-0 let the bar cover the card's last ~57px.
      style={{ bottom: 'var(--tab-bar-h)' }}
      data-testid="lab-node-card"
      data-kind={kind}
      data-name={name || ''}>
      <div className="w-full max-w-[560px] flex items-center justify-between flex-shrink-0">
        <button type="button" onClick={() => onClose?.()}
          data-testid="lab-node-card-back"
          className={`min-w-[44px] inline-flex items-center gap-1 ${FOCUS}`}
          style={{ ...actionStyle, textDecoration: 'none', fontSize: FS_SUB }}>
          <ChevronLeft size={20} />
          Back
        </button>
      </div>

      <div className="w-full max-w-[560px] flex flex-col pt-2 pb-10">
        {headerArt && (
          <div className="flex justify-center flex-shrink-0 mb-1" aria-hidden="true" data-testid="lab-node-card-art">{headerArt}</div>
        )}
        <h2 className="text-center flex-shrink-0"
          style={{ color: CHALK_CREAM, fontFamily: HAND, fontSize: FS_NAME, lineHeight: 1.05, textShadow: CHALK_TEXT_SHADOW, WebkitTextStroke: '1px rgba(8,8,8,0.55)', paintOrder: 'stroke fill' }}>
          {name}
        </h2>

        {/* Family line (drawn glass + family name), then the sub-group in plain words */}
        {clusterName && (
          <div className="flex flex-col items-center mt-1 flex-shrink-0 gap-1" data-testid="lab-node-card-cluster">
            <div className="flex items-center gap-2" data-testid="lab-node-card-family">
              {clusterArt}
              <span style={{ color: liftColor(clusterColor), fontFamily: HAND, fontSize: 22, textShadow: CHALK_TEXT_SHADOW }}>{clusterName}</span>
            </div>
            {clusterTag ? (
              <span data-testid="lab-node-card-subgroup" style={{ color: CHALK_DIM, fontFamily: TEXT, fontSize: 16 }}>{clusterTag}</span>
            ) : null}
            {yours ? (
              <span data-testid="lab-node-card-yours" style={{ color: CHALK_SUB, fontFamily: TEXT, fontSize: 13 }}>Yours</span>
            ) : null}
          </div>
        )}

        {/* Card actions: text controls in one group (e.g. "Riff on this", "Flavor profile", "Share") */}
        {(actions.length > 0 || flavor?.recipe || share?.link || (SHARE_OWN_ENABLED && ownShare?.item)) && (
          <div className="flex justify-center flex-wrap gap-x-6 gap-y-0 mt-4 flex-shrink-0" role="group" aria-label="Card actions">
            {(() => {
              const flavorAt = actions.findIndex((a) => /riff/i.test(a.label)) + 1; // right after "Riff on this"; first when there is none
              const flavorBtn = flavor?.recipe ? (
                <FlavorProfileButton key="flavor-profile" toggle={flavorToggle} className={`inline-flex items-center gap-1 ${FOCUS}`}
                  style={{ ...actionStyle, ...(flavorToggle.open ? { color: ACCENT, textDecorationColor: ACCENT } : {}) }}
                  label={<>Flavor profile<ChevronDown size={16} /></>} />
              ) : null;
              const btns = actions.map((a) => (
                <button key={a.label} type="button" onClick={a.onClick} data-testid={a.testid} className={FOCUS} style={actionStyle}>
                  {a.label}
                </button>
              ));
              if (flavorBtn) btns.splice(flavorAt, 0, flavorBtn);
              return btns;
            })()}
            {share?.link && (
              <ShareButton recipe={share.recipe} link={share.link} testid="card-share" className={`!px-0 ${FOCUS}`}
                style={{ ...actionStyle, border: 'none' }} />
            )}
            {ownShare?.item && (
              <OwnShareButton kind={ownShare.kind} item={ownShare.item} testid="card-own-share" className={`!px-0 ${FOCUS}`}
                style={{ ...actionStyle, border: 'none' }} />
            )}
          </div>
        )}

        {flavor?.recipe && <FlavorProfileSection toggle={flavorToggle} recipe={flavor.recipe} nodes={flavor.nodes} className="mt-3 flex-shrink-0" />}

        {/* Prep details */}
        {cleanDetails.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 flex-shrink-0">
            {cleanDetails.map((d) => (
              <span key={d.label} style={{ fontFamily: TEXT, fontSize: FS_SUB }}>
                <span style={{ color: CHALK_SUB }}>{d.label}: </span>
                <span style={{ color: CHALK_DIM }}>{d.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Kind-specific sections (e.g. the wine flavour profile) */}
        {children && <div className="flex-shrink-0">{children}</div>}

        {/* Ingredients */}
        {ingList.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>{ingredientsLabel}</SectionLabel>
            <ul className="flex flex-col gap-2" data-testid="lab-node-card-ingredients">
              {ingList.map((ing, i) => (
                <li key={`${ing.name}-${i}`} className="flex items-baseline gap-2"
                  style={{ fontFamily: TEXT, fontSize: FS_BODY, color: CHALK_CREAM }}>
                  {ing.measure ? (
                    <span className="flex-shrink-0 whitespace-nowrap" data-testid="labcard-ingredient-amount" style={{ color: CHALK_DIM, fontSize: FS_MEASURE }}>{ing.measure}</span>
                  ) : null}
                  <span className="min-w-0 max-w-full">
                    <IngredientName name={ing.name} loose tall testid="labcard-ingredient-link">{ing.name}</IngredientName>
                  </span>
                </li>
              ))}
            </ul>
            {ingredientsNote ? (
              <p className="mt-2" data-testid="lab-node-card-ingredients-note" style={{ fontFamily: TEXT, fontSize: 13, color: CHALK_SUB }}>{ingredientsNote}</p>
            ) : null}
          </div>
        )}

        {afterIngredients && <div className="flex-shrink-0">{afterIngredients}</div>}

        {/* Method: numbered steps when multi-step, else a paragraph. Cocktails and sauces carry no heading, just a chalk rule. */}
        {prep && (() => {
          const steps = kind === 'wine' ? [prep] : splitPrepSteps(prep);
          return (
            <div className="flex-shrink-0">
              {prepLabel
                ? <SectionLabel>{prepLabel}</SectionLabel>
                : <div data-testid="lab-node-card-rule" style={{ color: CHALK_RAIL, lineHeight: 0, marginTop: 24, marginBottom: 16 }} aria-hidden="true">{chalkRule()}</div>}
              {steps.length > 1 ? (
                <ol className="flex flex-col gap-2" data-testid="lab-node-card-prep">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-2"
                      style={{ fontFamily: TEXT, fontSize: FS_BODY, color: CHALK_CREAM, lineHeight: 1.45 }}>
                      <span className="flex-shrink-0" style={{ color: CHALK_SUB, fontWeight: 700 }}>{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p data-testid="lab-node-card-prep" style={{ fontFamily: TEXT, fontSize: FS_BODY, color: CHALK_CREAM, lineHeight: 1.45 }}>{prep}</p>
              )}
            </div>
          );
        })()}

        {afterMethod && <div className="flex-shrink-0">{afterMethod}</div>}

        {/* Like this */}
        {likeThis.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>{likeThisLabel}</SectionLabel>
            <NameList items={likeThis} onSelect={onSelect} testid="lab-node-card-like-this" />
          </div>
        )}

        {/* Cousins in other families */}
        {bridges.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>Cousins in other families</SectionLabel>
            <NameList items={bridges} onSelect={onSelect} showFamily testid="lab-node-card-bridges" columns={false} />
          </div>
        )}

        {/* Pairs with */}
        {Array.isArray(pairsWith) && pairsWith.length > 0 && (
          <div className="flex-shrink-0">
            <SectionLabel>Pairs with</SectionLabel>
            <NameList items={pairsWith} onSelect={null} ingredients testid="lab-node-card-pairs-with" />
          </div>
        )}
      </div>
    </div>
  );
}
