# Curation Notes — Flavor Graph (Tier-1/Tier-2/Tier-3 + leaves)

Reference for the chef-user filling in `top500_flavor_graph.csv`.

## CSV columns

| Column | Multi-value? | Example |
|---|---|---|
| `name` | no | `mint` |
| `tier1_aroma` | pipe-delimited | `green` |
| `tier2_taste` | pipe-delimited | `bitter\|astringent` |
| `tier3_mouthfeel` | pipe-delimited | `cooling\|pungent` |
| `leaves` | pipe-delimited | `menthol\|fresh\|sharp\|grassy\|herbaceous` |
| `sources` | pipe-delimited | `manual-top-500` |

## Tier-1 aroma vocabulary (5 terms — `spicy` excluded)

Pick **one** primary, but the column allows multi-value if an
ingredient sits across two aromas (e.g., black pepper = `green|woody`):

- `fruity`
- `floral`
- `green`
- `woody`
- `fatty`

**Note:** `spicy` is intentionally **NOT** in the Tier-1 vocabulary. The
`BRISCIONE_AROMA` palette in `src/data/briscionePalette.js` still
defines `spicy` as a sector for backward compatibility with the
WedgeGridFlavorWheel rendering, but the flavor graph never assigns
`spicy` at Tier 1 — `spicy` lives at Tier 2 only (see below). This
honors the autopilot pre-flight decision (`.omc/notepad.md` Q7).

## Tier-2 taste vocabulary (`salty` excluded at bake time)

Standard Briscione taste palette **minus salty**:

- `sweet`
- `sour`
- `bitter`
- `umami`
- `pungent`  (only enterable via curated `node.taste` overlay)
- `astringent` (only enterable via curated `node.taste` overlay)
- `spicy` (only enterable via curated `node.taste` overlay — represents
  the chili-sensation taste, NOT the GNN `odor_spicy` aroma head, which
  is permanently excluded by autopilot pre-flight Q6)

**Salty is filtered out at bake time.** Salt ingredients still render
in the 3D network with their existing cluster color — no regression
— but they will never carry `tier2_taste: salty` in the flavor graph.
This honors the pre-flight Q6 decision (chemDataset-status.md flags
salty as a data-ceiling weak head with calibrated F1 = 0.33).

## Tier-3 mouthfeel — open vocabulary

No fixed list. Common entries from the seed rules:

- `cooling`
- `pungent`
- `creamy`
- `sticky`
- `astringent`
- `crisp`
- `mucilaginous`
- `effervescent`

Chef-user may extend. Phase-2 walkthrough is the recovery path for
under-curated Tier-3 entries.

## Leaves — adjective-level descriptors

Free-form short adjectives (one to three words, lower-case, hyphen if
multi-word). Examples: `menthol`, `fresh`, `coconut`, `salty-savory`,
`brothy`, `fermented`. The renderer treats these as slate-gray chips
(no palette contract).

## 6 forbidden palette-family transitions

The P5 re-color soak gate fails if more than 50 ingredients in
`flavor_recolor_diff.json` undergo one of these transitions. These
flips are jarring enough that we want the chef-user to consciously
sign off:

1. `sweet → woody` (dairy/sweet flipping to woody-aroma is a strong identity break)
2. `sour → fatty` (acid → richness flip — unnatural in shipped clusters)
3. `salty → floral` (salt-cluster → floral palette is jarring)
4. `umami → fruity` (protein/savory → fruity is mis-leading)
5. `bitter → green` (bitter herbs flipping to "fresh green" loses bitter context)
6. `pungent → floral` (chili → delicate floral palette doesn't match)

If you want to avoid one of these for a specific ingredient, **leave
its `tier1_aroma` empty** — the renderer falls back to the existing
cluster color via the defensive path (plan §2.2 P5).

## Canonical fixture: mint

This is the worked example. Pre-filled by the executor; the chef-user
should treat it as the reference for "what a fully-curated row looks
like":

| Field | Value |
|---|---|
| `name` | `mint` |
| `tier1_aroma` | `green` |
| `tier2_taste` | `bitter\|astringent` |
| `tier3_mouthfeel` | `cooling\|pungent` |
| `leaves` | `menthol\|fresh\|sharp\|grassy\|herbaceous` |
| `sources` | `manual-top-500` |

Four other fixtures are also pre-filled (vanilla, soy sauce,
lemon, garlic) — each at minimum has a non-empty `tier1_aroma` so the
§2.4 P0 canonical-fixture preservation gate has an anchor.
