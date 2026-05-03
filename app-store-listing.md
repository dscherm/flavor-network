# App Store Listing — Flavor Network

Drop these straight into App Store Connect. Character limits noted next
to each field; current counts in parens.

---

## App Name (max 30 chars)

**Flavor Network** *(14)*

## Subtitle (max 30 chars)

**Pair flavors with chemistry** *(27)*

Alternates if you want a different angle:
- *Find flavors that pair* (22)
- *AI-powered flavor pairing* (25)
- *Pairing science for cooks* (26)

## Bundle ID

`com.neuralflavor.app` *(already configured in `capacitor.config.json`)*

## Primary Category

**Food & Drink**

## Secondary Category

**Reference** *(or Lifestyle if you want broader Search Today reach)*

---

## Promotional Text (max 170 chars — editable any time without re-review)

> Built on 2.2M recipes and real molecular chemistry. Explore 3,913 ingredients and 48,588 pairings across three living models: Pairing, Cocktail, and Sauce. *(168)*

---

## Description (max 4,000 chars — only the first ~170 show without "more")

```
Find flavors that work together.

Flavor Network is a 3D map of how 3,913 ingredients actually pair —
built on 2.2 million real recipes and the molecular chemistry behind
taste and aroma. Pick a model and start exploring.

PAIRING MODEL
A living network of every ingredient that's ever worked together in a
real kitchen. Tap any ingredient to see its top pairings, ranked by
how reliably they appear together across 2.2M recipes — weighted by
NPMI, a statistical measure of "more often than chance."

COCKTAIL MODEL
172 cocktails clustered into the seven super-families a bartender
actually uses: Old-Fashioned, Martini, Daiquiri, Sour, Highball,
Tiki, and Punch. See where the Negroni sits next to the Boulevardier,
and what's just one ingredient away.

SAUCE MODEL
77 sauces grouped into the ten mother families: Béchamel, Velouté,
Espagnole, Hollandaise, Tomato, Curry, Mole, Salsa, Pan Sauce, and
Vinaigrette. Trace how a beurre blanc relates to a hollandaise — by
ingredient overlap, not just by name.

WHAT MAKES IT DIFFERENT

• Real chemistry, not just "popular together." Every ingredient has
  a learned aroma profile from a graph neural network trained on
  19,902 flavor compounds.

• Three live datasets fused into one graph: RecipeNLG (2.2M recipes),
  TheMealDB (595 meals), TheCocktailDB (426 drinks).

• Recipe Lab — a notebook that suggests the *next* ingredient based
  on what's already in your bowl, instead of a generic top-10 list.

• Cocktail and Sauce Labs are scoped to their ingredient subsets,
  so the suggestions stay relevant to what you're actually making.

• No ads, no tracking. Optional Google sign-in to save recipes
  across devices; everything else stays on your device.

WHO IT'S FOR

If you've ever wondered why basil works with tomato but not with
apple, or what a Sazerac and a Manhattan actually share — this is
the app you've been looking for. Built for chefs, bartenders, and
the food-curious.
```

*(~1,950 chars — leaves room to grow)*

---

## Keywords (max 100 chars, comma-separated, no spaces after commas)

```
flavor,pairing,recipe,cooking,chef,ingredient,cocktail,sauce,mixology,foodie,gastronomy,chemistry
```

*(99 chars)*

Avoid wasting characters on words already in the app name/subtitle —
Apple indexes those automatically.

---

## What's New in This Version (max 4,000 chars — release notes)

For v1.0.0 (first ship):

```
Welcome to Flavor Network 1.0!

• Three exploration models: Pairing, Cocktail, Sauce
• Recipe Lab with AI-powered next-ingredient suggestions
• Save recipes to your profile (optional Google sign-in)
• Native iPhone polish: dark splash, status bar, haptic feedback
• Built on 2.2M real recipes + molecular flavor chemistry
```

---

## URLs

- **Support URL** (required) — needs to resolve to a working page.
  Suggested: a GitHub Issues page, a Notion doc, or a simple landing
  on a domain you control. Examples:
  - `https://github.com/dscherm/flavor-network/issues`
  - `https://flavornetwork.app/support` *(if you register the domain)*

- **Marketing URL** (optional) — your homepage. If you don't have one,
  leave blank. Skipping this is fine for v1.

- **Privacy Policy URL** (required for sign-in apps) — needs to cover:
  what you collect (Google email, display name, user ID, saved recipes),
  why (sign-in + sync), where it lives (Firebase Auth + Firestore in the
  US Google Cloud region), retention (until user deletes account),
  rights (request deletion via the app's profile screen), and a
  contact email. Free generators (Termly, iubenda) produce a compliant
  draft in 10 min.

---

## Age Rating

Walk through the questionnaire:
- No violence / sexual / drug references → 4+
- The Cocktail Model shows alcohol — Apple usually rates this 17+.
  If you're OK with 17+, declare "Frequent/Intense" for "Alcohol,
  Tobacco, or Drug Use or References." If you want 4+, you'd need
  to gate the Cocktail tab behind an age check or remove it.

**Recommended: 17+** — keeps the cocktail content native, avoids the
gate friction, and matches every other cocktail/bar app on the store.

---

## Privacy Questionnaire (App Privacy section)

Match what's already declared in `PrivacyInfo.xcprivacy`:

- **Email Address** — Linked to user, App Functionality only, no tracking
- **Name** — Linked to user, App Functionality only, no tracking
- **User ID** — Linked to user, App Functionality only, no tracking
- **Other User Content** (saved recipes/ingredients) — Linked,
  App Functionality only, no tracking
- **Tracking** — No

---

## App Store Screenshots

Apple needs at least one screenshot per device class. Easy mode:
take screenshots in the iOS Simulator (`npm run ios:open` → run on
iPhone 15 Pro Max → ⌘S to save). Required:

1. **6.9" iPhone** (16 Pro Max / 17 Pro Max) — 1320×2868
2. **6.5" iPhone** (older — XS Max / 11 Pro Max / etc.) — 1242×2688
3. **iPad** *only if you list as iPad-compatible* — 2048×2732

5–10 screenshots per class. Suggested shots:
- StartPage (the three mode cards) — establishes what the app is
- Network model with a node selected + side panel — shows depth
- Cocktail or Sauce Lab — shows the second model
- Recipe Lab with bowl + suggestions — shows the active workflow
- IngredientPanel close-up showing chemistry/pairings

---

## Pricing & Availability

- **Free** is the simplest first ship.
- **Availability**: All countries, or limit to US first if you want
  to test reception before going global.

---

## TestFlight (before final submission)

Add 1–10 internal testers (your Apple ID + close friends). Push the
first build, run the app for 24h on a real device, fix anything that
shakes out. Then submit for App Store review.

App Store Review typically lands within 24–48h. Common rejection
reasons for an app like this:
- Privacy policy doesn't match `PrivacyInfo.xcprivacy` declarations
- "Sign in with Apple" is missing while another sign-in (Google) is
  present — Apple now requires the alternative. **Plan a Sign-in-with-
  Apple addition before submission, or remove Google sign-in for v1
  and add both later.**
- Crash on launch on a real device (always test before submitting)
- Cocktail content not matched by 17+ rating

---

## TODOs before tap-to-submit

- [ ] Privacy policy URL drafted and live
- [ ] Support URL chosen and live
- [ ] At least one Sign-in-with-Apple option (or remove Google for v1)
- [ ] Screenshots captured (6.9", 6.5") in light AND dark splash modes
- [ ] Age rating set to 17+ (or gate the Cocktail tab)
- [ ] TestFlight build run for 24h on a real device
