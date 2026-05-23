"""build_alias_map.py — scaffold an alias map for outside-v3 ingredients.

For each name in ingredients.json that is NOT already in the v3
universe (flavor_positions_v3.json), propose a canonical alias from
the v3 set via:
  1. British → American hardcoded spelling map (aubergine → eggplant)
  2. Common plural/typo fixes (strawberrie → strawberry)
  3. Substring containment (non-fat milk → milk; semi sweet chocolate → chocolate)
  4. Fuzzy ratio ≥ HIGH_FUZZ_THRESHOLD (e.g., "challot" → "shallot")
  5. Medium-confidence fuzzy matches flagged for chef review

Output: flavor-gnn/curation/v3_alias_map.json with three buckets:
  - auto_high_confidence: applied automatically by derive_long_tail.py
  - flagged_medium: needs chef review before being moved to high
  - unmatched: outside-v3 names with no plausible canonical (true new ingredients)

Chef workflow:
  1. Run this script to regenerate candidates
  2. Review flagged_medium; move accepted aliases into auto_high_confidence
  3. Re-run derive_long_tail.py — aliased rows are dropped from the
     v3 universe (their pairings still flow through the canonical)
"""
from __future__ import annotations

import json
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INGREDIENTS = ROOT / "public" / "proDataset" / "ingredients.json"
POSITIONS = ROOT / "public" / "proDataset" / "flavor_positions.json"
CHEF_CSV = ROOT / "flavor-gnn" / "curation" / "top500_flavor_graph.csv"
OUT_JSON = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"

HIGH_FUZZ_THRESHOLD = 0.93
MEDIUM_FUZZ_THRESHOLD = 0.80  # lowered 0.85 → 0.80 (2026-05-23) to widen the flagged-medium pool
MIN_NAME_LEN = 3  # avoid 1-2 char false matches

# Canonical names too generic to act as alias targets via substring
# matching. e.g. "espresso powder" must NOT map to "powder" — the
# specificity is lost. Chef can promote individual matches into
# auto_high_confidence if appropriate (e.g. "fresh ginger" → "ginger"
# is fine because "ginger" is specific enough).
SUBSTRING_BLOCKLIST = frozenset({
    "powder", "cheese", "sauce", "oil", "salt", "sugar", "dressing",
    "syrup", "vinegar", "milk", "cream", "butter", "wine", "juice",
    "extract", "flavoring", "essence", "paste", "spread", "soup",
    "broth", "stock", "pepper", "seasoning", "mix", "leaf", "leaves",
    "seed", "seeds", "root", "powder mix", "drink", "tea",
})

# Pairs that should NEVER be auto-mapped even when fuzzy ratio is high.
# These are different ingredients with similar spelling. Chef-curated.
DENY_LIST: set[tuple[str, str]] = {
    ("black bear", "black bean"),
    ("brown bear", "brown bean"),
    ("pine", "pie"),
    ("rump", "rum"),
    ("brine", "brie"),
    ("white sucker", "white sauce"),
    ("flake crumb", "cake crumb"),
    ("yellow pea", "yellow peache"),
}

# British → American + common variant spellings the auto-detector
# can't infer from string similarity alone.
HARDCODED_ALIASES: dict[str, str] = {
    "aubergine": "eggplant",
    "courgette": "zucchini",
    "rocket": "arugula",
    "coriander": "cilantro",
    "challot": "shallot",
    "scallion": "green onion",
    "swede": "rutabaga",
    "mange tout": "snow pea",
    "mangetout": "snow pea",
    "sultana": "raisin",
    "sultana raisin": "raisin",
    "treacle": "molasses",
    "demerara sugar": "brown sugar",
    "icing sugar": "powdered sugar",
    "caster sugar": "sugar",
    "bicarbonate of soda": "baking soda",
    "natural yogurt": "yogurt",
    "double cream": "heavy cream",
    "single cream": "light cream",
    "soured cream": "sour cream",
    "tomato puree": "tomato paste",
    "passata": "tomato puree",
    "minced beef": "ground beef",
    "minced lamb": "ground lamb",
    "minced pork": "ground pork",
    "minced turkey": "ground turkey",
    "prawn": "shrimp",
    "prawns": "shrimp",
    "biscuit": "cookie",
    "chip": "fry",
    "crisps": "potato chip",
    "kipper": "smoked herring",
    "swiss chard": "chard",
    "spring onion": "green onion",
    # 2026-05-23 chef-pass additions: common ground/dried/raw forms
    "ground beef": "beef",
    "ground turkey": "turkey",
    "ground chicken": "chicken",
    "ground lamb": "lamb",
    "ground pork": "pork",
    "active dry yeast": "yeast",
    "active yeast": "yeast",
    "instant yeast": "yeast",
    "dry yeast": "yeast",
    "raw honey": "honey",
    "raw sugar": "sugar",
    "raw shrimp": "shrimp",
    "raw chicken": "chicken",
    "fresh ginger": "ginger",
    "fresh garlic": "garlic",
    "fresh basil": "basil",
    "fresh mint": "mint",
    "fresh parsley": "parsley",
    "fresh thyme": "thyme",
    "fresh rosemary": "rosemary",
    "fresh oregano": "oregano",
    "fresh cilantro": "cilantro",
    "fresh dill": "dill",
    "fresh sage": "sage",
    "fresh chive": "chive",
    "fresh chives": "chive",
    "dried oregano": "oregano",
    "dried basil": "basil",
    "dried thyme": "thyme",
    "dried mint": "mint",
    "dried parsley": "parsley",
    "dried rosemary": "rosemary",
    "dried sage": "sage",
    "dried dill": "dill",
    "dried cilantro": "cilantro",
    "dried tarragon": "tarragon",
    "dried marjoram": "marjoram",
    "dried bay leaf": "bay leaf",
    "dried bay leaves": "bay leaf",
    "smoked paprika": "paprika",
    "sweet paprika": "paprika",
    "hot paprika": "paprika",
    "kosher salt": "salt",
    "sea salt": "salt",
    "table salt": "salt",
    "fine salt": "salt",
    "coarse salt": "salt",
    "rock salt": "salt",
    "white sugar": "sugar",
    "granulated sugar": "sugar",
    "confectioners sugar": "powdered sugar",
    "confectioner's sugar": "powdered sugar",
    "extra virgin olive oil": "olive oil",
    "virgin olive oil": "olive oil",
    "light olive oil": "olive oil",
    "vegetable oil": "oil",
    "canola oil": "oil",
    "sunflower oil": "oil",
    "all purpose flour": "flour",
    "all-purpose flour": "flour",
    "whole wheat flour": "flour",
    "whole-wheat flour": "flour",
    "bread flour": "flour",
    "cake flour": "flour",
    "self rising flour": "flour",
    "self-rising flour": "flour",
    "italian seasoning": "herb",
    "italian herbs": "herb",
    "italian herb": "herb",
    "mixed herbs": "herb",
    "herbes de provence": "herb",
    "non fat milk": "milk",
    "non-fat milk": "milk",
    "skim milk": "milk",
    "whole milk": "milk",
    "low fat milk": "milk",
    "low-fat milk": "milk",
    "two percent milk": "milk",
    "2% milk": "milk",
    "1% milk": "milk",
    "evaporated milk": "milk",
    "powdered milk": "milk",
    "dry milk": "milk",
    "condensed milk": "milk",
    "sweetened condensed milk": "milk",
    "buttermilk": "milk",
    "almond milk": "milk",
    "soy milk": "milk",
    "oat milk": "milk",
    "coconut milk": "milk",
    "rice milk": "milk",
    "kefir": "milk",
    "low fat yogurt": "yogurt",
    "low-fat yogurt": "yogurt",
    "non fat yogurt": "yogurt",
    "non-fat yogurt": "yogurt",
    "greek yogurt": "yogurt",
    "plain yogurt": "yogurt",
    "vanilla yogurt": "yogurt",
    "frozen yogurt": "yogurt",
    "low sodium soy sauce": "soy sauce",
    "low-sodium soy sauce": "soy sauce",
    "dark soy sauce": "soy sauce",
    "light soy sauce": "soy sauce",
    "tamari": "soy sauce",
    "shoyu": "soy sauce",
    "rice vinegar": "vinegar",
    "white vinegar": "vinegar",
    "red wine vinegar": "vinegar",
    "white wine vinegar": "vinegar",
    "apple cider vinegar": "vinegar",
    "cider vinegar": "vinegar",
    "balsamic vinegar": "vinegar",
    "white wine": "wine",
    "red wine": "wine",
    "dry white wine": "wine",
    "dry red wine": "wine",
    "rice wine": "wine",
    "cooking wine": "wine",
    "sherry": "wine",
    "marsala": "wine",
    "vermouth": "wine",
    "port wine": "wine",
    "absolut citron": "vodka",
    "absolut kurant": "vodka",
    "absolut peppar": "vodka",
    "absolut vanilla": "vodka",
    "absolut": "vodka",
    "stoli": "vodka",
    "smirnoff": "vodka",
    "grey goose": "vodka",
    "jack daniels": "whiskey",
    "jack daniel's": "whiskey",
    "jim beam": "whiskey",
    "maker's mark": "whiskey",
    "bourbon": "whiskey",
    "rye whiskey": "whiskey",
    "scotch": "whiskey",
    "scotch whisky": "whiskey",
    "irish whiskey": "whiskey",
    "tabasco": "hot sauce",
    "tabasco sauce": "hot sauce",
    "sriracha": "hot sauce",
    "sriracha sauce": "hot sauce",
    "frank's red hot": "hot sauce",
    "frank's hot sauce": "hot sauce",
    "louisiana hot sauce": "hot sauce",
    "chili sauce": "hot sauce",
    "chile sauce": "hot sauce",
    "ketchup": "tomato ketchup",
    "tomato ketchup": "ketchup",
    "mayo": "mayonnaise",
    "mayonaise": "mayonnaise",
    "miracle whip": "mayonnaise",
    "italian dressing": "salad dressing",
    "ranch dressing": "salad dressing",
    "blue cheese dressing": "salad dressing",
    "caesar dressing": "salad dressing",
    "thousand island dressing": "salad dressing",
    "honey mustard dressing": "salad dressing",
    "vinaigrette": "salad dressing",
    "active dry": "yeast",
    "additional oil": "oil",
    "cooking oil": "oil",
    "frying oil": "oil",
    "salad oil": "oil",
    "olive": "olive",
    "kalamata olive": "olive",
    "black olive": "olive",
    "green olive": "olive",
    "stuffed olive": "olive",
    "pitted olive": "olive",
    "ripe olive": "olive",
    "fresh ground pepper": "black pepper",
    "freshly ground pepper": "black pepper",
    "freshly ground black pepper": "black pepper",
    "cracked pepper": "black pepper",
    "cracked black pepper": "black pepper",
    "ground black pepper": "black pepper",
    "ground pepper": "black pepper",
    "white pepper": "pepper",
    "cayenne": "cayenne pepper",
    "cayenne powder": "cayenne pepper",
}

# Strippable prefixes/suffixes that, when removed, often reveal the
# canonical name (e.g. "fresh basil" → "basil", "ground beef" → "beef",
# "minced garlic" → "garlic"). Applied ONLY when the stripped form is
# in v3 — never invents new mappings.
STRIP_PREFIXES = (
    "fresh ", "dried ", "ground ", "minced ", "chopped ", "diced ",
    "sliced ", "grated ", "crushed ", "shredded ", "frozen ", "raw ",
    "cooked ", "roasted ", "toasted ", "baked ", "boiled ", "steamed ",
    "smoked ", "cured ", "pickled ", "fermented ", "aged ",
    "whole ", "fine ", "coarse ", "rough ", "thin ", "thick ",
    "extra ", "large ", "small ", "medium ", "baby ",
    "premium ", "organic ", "natural ", "pure ", "plain ", "unsalted ",
    "salted ", "lightly salted ", "low sodium ", "low-sodium ", "low fat ",
    "low-fat ", "fat free ", "fat-free ", "non fat ", "non-fat ", "reduced fat ",
    "reduced-fat ", "sugar free ", "sugar-free ", "unsweetened ", "sweetened ",
    "sour ", "sweet ", "hot ", "mild ", "spicy ", "savory ", "salty ",
    "young ", "old ", "ripe ", "unripe ", "green ", "yellow ", "red ",
    "white ", "black ", "dark ", "light ",
    "italian ", "mexican ", "french ", "asian ", "thai ", "indian ",
    "chinese ", "japanese ", "spanish ", "greek ", "mediterranean ",
    "american ", "southern ", "californian ", "kentucky ",
)

STRIP_SUFFIXES = (
    " pieces", " piece", " chunks", " chunk", " bits", " bit",
    " strips", " strip", " slices", " slice", " wedges", " wedge",
    " cubes", " cube", " halves", " half", " quarters", " quarter",
    " powder", " flakes", " flake", " granules",
    " (raw)", " (cooked)", " (fresh)", " (dried)", " (frozen)",
    ", chopped", ", diced", ", sliced", ", minced", ", grated",
    ", fresh", ", dried", ", ground", ", whole", ", cooked",
)


def normalize(s: str) -> str:
    return s.strip().lower()


def is_plural_typo(name: str, canonical: str) -> bool:
    """Catch 'strawberrie' (missing s of 'strawberries'), 'tomatoe', etc."""
    if name.endswith("e") and not canonical.endswith("e"):
        if name[:-1] == canonical:
            return True
        if name[:-1] + "y" == canonical:
            return True
    if name.endswith("ies") and canonical.endswith("y"):
        if name[:-3] + "y" == canonical:
            return True
    if name + "s" == canonical or canonical + "s" == name:
        return True
    return False


def contains_canonical(name: str, canonical: str) -> bool:
    """name 'non-fat milk' CONTAINS canonical 'milk' as a word-boundary token."""
    if len(canonical) < MIN_NAME_LEN:
        return False
    tokens = name.replace("-", " ").split()
    if canonical in tokens:
        return True
    # Multi-word canonical (e.g., "green onion" inside "young green onion")
    if " " in canonical and canonical in name:
        return True
    return False


def fuzzy_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def strip_modifiers(name: str) -> str:
    """Aggressively strip cooking-modifier prefixes and suffixes.

    "fresh basil" → "basil", "ground beef" → "beef", "minced garlic,
    chopped" → "garlic". Returns the stripped form; if no
    modifications applied, returns the original. Repeats until stable
    so chained modifiers ("fresh ground black pepper, cracked") fold.
    """
    s = name
    for _ in range(4):  # bound recursion; ~3 chained modifiers max
        before = s
        for suf in STRIP_SUFFIXES:
            if s.endswith(suf):
                s = s[: -len(suf)].strip()
                break
        for pre in STRIP_PREFIXES:
            if s.startswith(pre):
                s = s[len(pre):].strip()
                break
        if s == before:
            break
    return s


def find_best_canonical(
    name: str, v3_names: list[str], v3_set: set[str]
) -> tuple[str | None, float, str]:
    """Return (best_canonical, confidence, reason)."""
    if name in v3_set:
        return name, 1.0, "exact"
    # Hardcoded
    if name in HARDCODED_ALIASES:
        c = HARDCODED_ALIASES[name]
        if c in v3_set:
            return c, 1.0, "hardcoded"
    # Modifier strip — "fresh basil" → "basil", "active dry yeast" → "yeast"
    stripped = strip_modifiers(name)
    if stripped != name and stripped in v3_set and len(stripped) >= MIN_NAME_LEN:
        return stripped, 0.97, "modifier-strip"
    # Modifier strip + hardcoded lookup on the stripped form
    if stripped != name and stripped in HARDCODED_ALIASES:
        c = HARDCODED_ALIASES[stripped]
        if c in v3_set:
            return c, 0.97, "modifier-strip+hardcoded"
    # Plural / typo fixes
    for c in v3_names:
        if is_plural_typo(name, c):
            return c, 0.99, "plural-fix"
    # Substring containment — but skip over-generic canonicals
    containment_matches = [
        c for c in v3_names
        if contains_canonical(name, c) and c not in SUBSTRING_BLOCKLIST
    ]
    if containment_matches:
        best = max(containment_matches, key=len)
        return best, 0.95, "contains"
    # Fuzzy
    best_c, best_r = None, 0.0
    for c in v3_names:
        if abs(len(name) - len(c)) > 4:
            continue
        if (name, c) in DENY_LIST:
            continue
        r = fuzzy_ratio(name, c)
        if r > best_r:
            best_r, best_c = r, c
    if best_c is not None and best_r >= MEDIUM_FUZZ_THRESHOLD:
        return best_c, best_r, "fuzzy"
    return None, 0.0, "unmatched"


def build() -> None:
    ingredients = json.loads(INGREDIENTS.read_text(encoding="utf-8"))
    v3_universe = set(json.loads(POSITIONS.read_text(encoding="utf-8")).keys())

    # Also include chef CSV names (may extend beyond flavor_positions)
    import csv
    with CHEF_CSV.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if name:
                v3_universe.add(name)

    v3_names = sorted(v3_universe)
    outside = sorted([
        n for n in ingredients.keys()
        if not n.startswith("_") and n not in v3_universe
    ])

    auto_high: dict[str, str] = {}
    flagged_medium: dict[str, dict] = {}
    unmatched: list[str] = []

    for name in outside:
        canonical, conf, reason = find_best_canonical(name, v3_names, v3_universe)
        if canonical is None:
            unmatched.append(name)
        elif conf >= HIGH_FUZZ_THRESHOLD or reason in ("hardcoded", "plural-fix", "contains"):
            auto_high[name] = canonical
        else:
            flagged_medium[name] = {
                "suggested": canonical,
                "confidence": round(conf, 3),
                "reason": reason,
            }

    payload = {
        "_comment": "Auto-generated alias map. 'auto_high_confidence' is applied by derive_long_tail.py; 'flagged_medium' needs chef review (promote acceptable matches into auto_high_confidence). 'unmatched' = true new ingredients with no canonical equivalent.",
        "_stats": {
            "v3_universe": len(v3_universe),
            "outside_v3": len(outside),
            "auto_high": len(auto_high),
            "flagged_medium": len(flagged_medium),
            "unmatched": len(unmatched),
        },
        "auto_high_confidence": auto_high,
        "flagged_medium": flagged_medium,
        "unmatched": unmatched,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[alias] wrote {OUT_JSON.relative_to(ROOT)}")
    print(f"[alias] v3 universe: {len(v3_universe)}")
    print(f"[alias] outside v3:  {len(outside)}")
    print(f"  auto_high:        {len(auto_high)}")
    print(f"  flagged_medium:   {len(flagged_medium)}")
    print(f"  unmatched:        {len(unmatched)}")


if __name__ == "__main__":
    build()
