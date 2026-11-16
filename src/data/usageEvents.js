/**
 * Usage events (USAGE-2): the one catalogue of what the app can report, and the
 * typed helpers every call site uses. Nothing else in the app calls track().
 *
 *   import { usage } from '../data/usageEvents.js';
 *   usage.labOpened('cocktail');
 *
 * Each helper builds its params from the catalogue below and from nothing else:
 * a key that is not listed is dropped, an enum value that is not listed drops the
 * whole event, text is trimmed, lowercased and cut to 60 characters, and a
 * built-in recipe slug is only ever sent for built-in recipes. Names, ids and
 * ingredient lines of a user's own recipe are never read, so they cannot leak
 * even when a caller hands them in by mistake. Helpers never throw and send
 * nothing without consent (usage.js).
 *
 * docs/usage-data.md holds the same table for people, the privacy page lists the
 * `plain` sentences, and tests keep all three in step.
 */
import { track } from './usage.js';

export const TEXT_MAX = 60;
const COUNT_MAX = 9999;

const LABS = ['cocktail', 'sauce', 'recipe'];
const SHARE_KINDS = ['cocktail', 'sauce', 'dish'];
const ORIGINS = ['built_in', 'own'];
const ROUTES = ['key', 'code'];
const PROVIDERS = ['google', 'apple'];
const SHOP_WHERE = ['list', 'panel'];

/**
 * Param types:
 *   enum   one of `values`
 *   text   free text: trimmed, lowercased, at most TEXT_MAX characters
 *   count  whole number 0..9999
 *   slug   a built-in recipe slug; only kept when the event's `origin` is built_in
 * Params are required unless `optional: true` (an invalid optional param is just left out).
 */
export const EVENTS = Object.freeze({
  lab_opened: {
    plain: 'Which lab or page is opened.',
    fires: 'A lab, the Cookbook or the Pairing Lab becomes the open page (once per opening, not per re-render).',
    params: { lab: { type: 'enum', values: ['cocktail', 'sauce', 'recipe', 'make', 'cookbook', 'pairing', 'wine', 'network'] } },
  },
  invent_started: {
    plain: 'That an invent panel was started.',
    fires: 'The cook answers the first question of an invent panel, or the panel opens already holding a search (once per run; Start over begins a new run).',
    params: { lab: { type: 'enum', values: LABS } },
  },
  invent_style_chosen: {
    plain: 'That a style, technique or dish type was chosen in an invent panel.',
    fires: 'The cook picks a style or accepts the recommended one (each change of choice).',
    params: { lab: { type: 'enum', values: LABS } },
  },
  invent_named: {
    plain: 'That an invention was given a name (never the name).',
    fires: 'The cook leaves the name box with something typed in it (once per run).',
    params: { lab: { type: 'enum', values: LABS } },
  },
  invent_saved: {
    plain: 'That an invention was saved to an account (never its name or ingredients).',
    fires: 'An invention is written to the cook\'s account, including a save that completes after sign-in.',
    params: { lab: { type: 'enum', values: LABS } },
  },
  share_sheet_opened: {
    plain: 'That a share sheet was opened, for a built-in or an own recipe, and which built-in recipe.',
    fires: 'The share sheet opens.',
    params: {
      kind: { type: 'enum', values: SHARE_KINDS },
      origin: { type: 'enum', values: ORIGINS },
      slug: { type: 'slug', optional: true },
    },
  },
  share_link_created: {
    plain: 'That a public link was created for an own recipe (never its id or contents).',
    fires: 'The cook taps Create link and the link is written.',
    params: { kind: { type: 'enum', values: SHARE_KINDS } },
  },
  shared_page_opened: {
    plain: 'That a shared recipe page was opened, and which built-in recipe.',
    fires: 'A shared recipe page finishes loading a recipe (once per page load).',
    params: {
      kind: { type: 'enum', values: SHARE_KINDS },
      origin: { type: 'enum', values: ORIGINS },
      slug: { type: 'slug', optional: true },
    },
  },
  shared_saved: {
    plain: 'That a shared recipe was saved to an account.',
    fires: 'A recipe is saved to the account from a shared page, including a save that completes after sign-in.',
    params: { kind: { type: 'enum', values: SHARE_KINDS }, origin: { type: 'enum', values: ORIGINS } },
  },
  shared_signup: {
    plain: 'That a new account was created from a shared recipe page.',
    fires: 'A sign-in started on a shared page creates a new account (pop-up sign-in only).',
    params: { kind: { type: 'enum', values: SHARE_KINDS }, origin: { type: 'enum', values: ORIGINS } },
  },
  search_no_result: {
    plain: 'A search that found nothing, with the words typed.',
    fires: 'A search box holds text that matches nothing and stays unchanged for about a second (once per settled query, not per keystroke).',
    params: { lab: { type: 'enum', values: ['cocktail', 'sauce', 'cookbook'] }, term: { type: 'text' } },
  },
  ingredient_unrecognised: {
    plain: 'An ingredient name the app did not recognise, with the words typed.',
    fires: 'The cook types an ingredient (or a bottle) that is not in the ingredient list and submits it.',
    params: { lab: { type: 'enum', values: ['cocktail', 'sauce', 'recipe', 'bar'] }, text: { type: 'text' } },
  },
  scan_started: {
    plain: 'That a bar photo scan was started, and whether it used the cook\'s own key or an invite code.',
    fires: 'A photo is picked for My bar and sent to be read.',
    params: { route: { type: 'enum', values: ROUTES } },
  },
  scan_succeeded: {
    plain: 'That a bar photo scan read some bottles, and how many.',
    fires: 'The scan returns and at least one bottle or item is listed for review.',
    params: { route: { type: 'enum', values: ROUTES }, count: { type: 'count' } },
  },
  scan_kept: {
    plain: 'How many scanned bottles were kept (a number only).',
    fires: 'The cook confirms the review list and the checked bottles are added to My bar.',
    params: { route: { type: 'enum', values: ROUTES }, count: { type: 'count' } },
  },
  shop_opened: {
    plain: 'That the shopping list was opened (nothing about what is on it).',
    fires: 'The shopping list screen opens (once per opening).',
    params: {},
  },
  shop_recipe_added: {
    plain: 'That ingredients of a recipe were added to the shopping list: its kind, whether it is built-in or the cook\'s own, where it was added from, and how many items were added or merged into lines already there (never the items, and never the name of an own recipe).',
    fires: 'Ingredients of a recipe are added to the shopping list, from Add from a recipe on the list or from an Add to shopping list button on a What do I need? panel.',
    params: {
      kind: { type: 'enum', values: SHARE_KINDS },
      origin: { type: 'enum', values: ORIGINS },
      slug: { type: 'slug', optional: true },
      where: { type: 'enum', values: SHOP_WHERE },
      added: { type: 'count' },
      merged: { type: 'count' },
    },
  },
  shop_alternative_used: {
    plain: 'That a shopping-list alternative was used, whether it came from the food or the bar table and whether it replaced the item or the cook used what they had (never which ingredient).',
    fires: 'The cook picks an alternative for an item the store does not have, either replacing the row or using what they already have.',
    params: {
      alt_source: { type: 'enum', values: ['food', 'bar'] },
      outcome: { type: 'enum', values: ['replaced', 'used_own'] },
    },
  },
  signin_started: {
    plain: 'That sign-in was started, and with which provider.',
    fires: 'The cook taps Sign in with Google or Apple.',
    params: { provider: { type: 'enum', values: PROVIDERS } },
  },
  signin_completed: {
    plain: 'That sign-in finished, and with which provider.',
    fires: 'Sign-in succeeds (pop-up, or the return from a redirect sign-in).',
    params: { provider: { type: 'enum', values: PROVIDERS } },
  },
});

function cleanText(v) {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, TEXT_MAX).trim();
  if (!t) return null;
  // Not a name or an address: something that looks like contact details is not sent at all.
  if (/@|https?:\/\/|www\./.test(t)) return null;
  return t;
}

function cleanSlug(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(t) ? t : null;
}

function cleanParam(spec, v) {
  switch (spec.type) {
    case 'enum': return spec.values.includes(v) ? v : null;
    case 'text': return cleanText(v);
    case 'slug': return cleanSlug(v);
    case 'count': {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 ? Math.min(n, COUNT_MAX) : null;
    }
    default: return null;
  }
}

/** Build the params an event may carry from `input`, or null when a required one is missing or invalid. */
export function buildParams(event, input) {
  const def = EVENTS[event];
  if (!def) return null;
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  for (const [name, spec] of Object.entries(def.params)) {
    if (spec.type === 'slug' && src.origin !== 'built_in') continue;
    const val = cleanParam(spec, src[name]);
    if (val === null) {
      if (spec.optional) continue;
      return null;
    }
    out[name] = val;
  }
  return out;
}

function emit(event, input) {
  try {
    const params = buildParams(event, input);
    if (params) track(event, params);
  } catch { /* never throws */ }
}

const one = (event, name) => (value) => emit(event, { [name]: value });

export const usage = Object.freeze({
  labOpened: one('lab_opened', 'lab'),
  inventStarted: one('invent_started', 'lab'),
  inventStyleChosen: one('invent_style_chosen', 'lab'),
  inventNamed: one('invent_named', 'lab'),
  inventSaved: one('invent_saved', 'lab'),
  shareSheetOpened: (o) => emit('share_sheet_opened', o),
  shareLinkCreated: one('share_link_created', 'kind'),
  sharedPageOpened: (o) => emit('shared_page_opened', o),
  sharedSaved: (o) => emit('shared_saved', o),
  sharedSignup: (o) => emit('shared_signup', o),
  searchNoResult: (lab, term) => emit('search_no_result', { lab, term }),
  ingredientUnrecognised: (lab, text) => emit('ingredient_unrecognised', { lab, text }),
  scanStarted: one('scan_started', 'route'),
  scanSucceeded: (route, count) => emit('scan_succeeded', { route, count }),
  scanKept: (route, count) => emit('scan_kept', { route, count }),
  shopOpened: () => emit('shop_opened', {}),
  shopRecipeAdded: (o) => emit('shop_recipe_added', o),
  shopAlternativeUsed: (o) => emit('shop_alternative_used', o),
  signinStarted: one('signin_started', 'provider'),
  signinCompleted: one('signin_completed', 'provider'),
});

/** The lab name for a saved-item kind ('cocktail' | 'sauce' | 'recipe'). */
export const labForKind = (kind) => (LABS.includes(kind) ? kind : null);
