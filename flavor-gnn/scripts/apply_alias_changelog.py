"""apply_alias_changelog.py — apply chef review corrections to v3_alias_map.

The user's chef-review pass for the 2026-05-23 alias map is captured
verbatim in this script. After build_alias_map.py regenerates the
baseline JSON, this script applies the corrections:

  - FIXED:    auto_high entries whose value was semantically wrong
              (e.g., "bitter cherry" was → "bitter", should be "cherry")
  - REMOVED:  auto_high entries with no valid parent (Jerusalem
              artichoke ≠ artichoke; the genus is different)
  - PROMOTED: flagged_medium entries the chef accepts as-is
  - REMAPPED: flagged_medium entries the chef remaps to a different
              canonical (e.g., "passata" → "tomato sauce", not "pasta")
  - REJECTED: flagged_medium entries with no valid canonical → unmatched

After this script runs, the JSON map has 782 auto_high / 0 flagged /
513 unmatched. The decisions are checked into the repo so a future
re-run of build_alias_map.py can be patched back to this state.

Usage:
  python flavor-gnn/scripts/build_alias_map.py      # regenerate baseline
  python flavor-gnn/scripts/apply_alias_changelog.py # apply chef pass
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP_PATH = ROOT / "flavor-gnn" / "curation" / "v3_alias_map.json"


FIXED: dict[str, str] = {
    "bitter cherry": "cherry",
    "bitter lemon": "lemon",
    "bitter orange": "orange",
    "cherry tomato": "tomatoe",
    "egg plant": "eggplant",
    "lemon sole": "fish",
    "scotch bonnet": "chilie",
    "scotch spearmint": "mint",
    "turkey berry": "berry",
    "european anchovy": "anchovy",
    "european rabbit": "rabbit",
    "grape seed oil": "vegetable",
    "lemon grass": "lemongrass",
    "dark brown soft sugar": "brown sugar",
    "light oil": "vegetable",
    "extra virgin extra virgin olive oil": "olive oil",
    "extra-virgin extra virgin olive oil": "olive oil",
    "extravirgin olive oil": "olive oil",
}

REMOVED_FROM_AUTO: list[str] = [
    "jerusalem artichoke",
    "prickly pear",
    "sea cucumber",
    "giant butterbur",
    "grape nut",
    "grape nut cereal",
]

PROMOTED_FROM_FLAGGED: dict[str, str] = {
    "chile": "chilie",
    "chile flake": "chili flake",
    "chile oil": "chili oil",
    "chile paste": "chili paste",
    "chile powder": "chili powder",
    "chilli": "chili",
    "chillie": "chilie",
    "strawberrie": "strawberry",
    "raspberrie": "raspberry",
    "blackberrie": "blackberry",
    "blueberrie": "blueberry",
    "cranberrie": "cranberry",
    "cardomom": "cardamom",
    "cardamon seed": "cardamom seed",
    "hazlenut": "hazelnut",
    "lavendar": "lavender",
    "mayonaisse": "mayonnaise",
    "mayonnai": "mayonnaise",
    "gruyère": "gruyere",
    "whisky": "whiskey",
    "yoghurt": "yogurt",
    "black eyed pea": "black-eyed pea",
    "four-cheese": "four cheese",
    "half-and-half": "half and half",
    "lasagne noodle": "lasagna noodle",
    "no salt": "no-salt",
    "no sugar": "no-sugar",
    "red-pepper": "red pepper",
    "redcurrant": "currant",
    "mixed berrie": "mixed berry",
    "butter +": "butter",
    "milk +": "milk",
    "salt +": "salt",
    "sugar +": "sugar",
    "coco sugar": "coconut sugar",
    "chipotle powder": "chili powder",
    "bilberry": "blueberry",
    "cookie crust": "cookie pie crust",
    "graham wafer crumb": "graham cracker crumb",
    "safflower": "safflower oil",
    "peachtree schnapp": "peach schnapp",
    "graham crust": "graham pie crust",
}

REMAPPED_FROM_FLAGGED: dict[str, str] = {
    "jeera powder": "cumin",
    "tumeric powder": "turmeric",
    "cacao powder": "cocoa",
    "passata": "tomato sauce",
    "toffee": "caramel",
    "pot roast": "beef",
    "sirloin steak": "beef",
    "corona": "beer",
    "orgeat syrup": "almond",
    "anise": "aniseed",
    "bird chile": "chilie",
    "black crowberry": "berry",
    "black mulberry": "berry",
    "comte cheese": "cheese",
    "domiati cheese": "cheese",
    "dressing mix": "dressing",
    "flatfish": "fish",
    "frybread": "bread",
    "green pea": "peas",
    "jello": "jelly",
    "jostaberry": "berry",
    "other cheese": "cheese",
    "packets yeast": "yeast",
    "red snapper": "fish",
    "rowanberry": "berry",
    "russian cheese": "cheese",
    "sablefish": "fish",
    "seedless red": "grape",
    "sheefish": "fish",
    "sheep cheese": "cheese",
    "sheep milk": "milk",
    "sunflower": "sunflower seed",
    "sweet green pea": "peas",
    "sweet pea": "peas",
    "thin noodle": "noodles",
    "tilsit cheese": "cheese",
    "white sucker": "fish",
    "wide noodle": "noodles",
    "yeast roll": "bread",
    "yellow pea": "peas",
    ".salt": "salt",
    "-milk": "milk",
}

REJECTED_FROM_FLAGGED: list[str] = [
    "'s cheese",
    "'s sauce",
    "'s sugar",
    "achiote powder",
    "anisette",
    "baking pan",
    "baking powder",
    "beaver",
    "black bear",
    "brown bear",
    "bilberry wine",
    "bisquick baking",
    "bisquick baking mix",
    "black tea",
    "green tea",
    "bonito flakes",
    "borage",
    "bouillon powder",
    "calamu",
    "cane juice",
    "carom seed",
    "cedar",
    "chinese quince",
    "common verbena",
    "cookie crumb",
    "curly leaf",
    "file powder",
    "freshly squeezed juice",
    "grill seasoning",
    "longan",
    "margarine",
    "minute",
    "pate",
    "powdered",
    "powdered alum",
    "romano pepper",
    "sherbet",
    "sour mix",
    "soy cream",
    "tia maria",
    "vegan butter",
    "vegetarian food",
    "vine leave",
    "white baking",
    "white lupine",
    "white tequila",
    "yellow chartreuse",
]


def apply() -> None:
    doc = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    auto: dict[str, str] = dict(doc.get("auto_high_confidence", {}))
    flagged: dict[str, dict] = dict(doc.get("flagged_medium", {}))
    unmatched: list[str] = list(doc.get("unmatched", []))

    stats = {"fixed": 0, "removed": 0, "promoted": 0, "remapped": 0, "rejected": 0}

    for name, new_value in FIXED.items():
        if name in auto:
            auto[name] = new_value
            stats["fixed"] += 1

    for name in REMOVED_FROM_AUTO:
        if name in auto:
            del auto[name]
            if name not in unmatched:
                unmatched.append(name)
            stats["removed"] += 1

    for name, value in PROMOTED_FROM_FLAGGED.items():
        if name in flagged:
            del flagged[name]
        auto[name] = value
        stats["promoted"] += 1

    for name, value in REMAPPED_FROM_FLAGGED.items():
        if name in flagged:
            del flagged[name]
        auto[name] = value
        stats["remapped"] += 1

    for name in REJECTED_FROM_FLAGGED:
        if name in flagged:
            del flagged[name]
        if name not in unmatched:
            unmatched.append(name)
        stats["rejected"] += 1

    doc["auto_high_confidence"] = dict(sorted(auto.items()))
    doc["flagged_medium"] = dict(sorted(flagged.items()))
    doc["unmatched"] = sorted(unmatched)
    doc["_stats"] = {
        **doc.get("_stats", {}),
        "auto_high": len(auto),
        "flagged_medium": len(flagged),
        "unmatched": len(unmatched),
        "chef_corrections_applied_2026_05_23": stats,
    }

    MAP_PATH.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"[alias-chef] wrote {MAP_PATH.relative_to(ROOT)}")
    print(f"[alias-chef] auto_high_confidence: {len(auto)}")
    print(f"[alias-chef] flagged_medium:       {len(flagged)}")
    print(f"[alias-chef] unmatched:            {len(unmatched)}")
    print(f"[alias-chef] corrections: {stats}")


if __name__ == "__main__":
    apply()
