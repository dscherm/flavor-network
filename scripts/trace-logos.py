"""
Trace the top logo PNGs to SVG using vtracer.

vtracer preserves color regions (unlike potrace which is monochrome), so
we keep the multi-color glow palette of the AI renders. The output SVG
won't be hand-tuned — it's a vector starting point for further cleanup
in Inkscape/Illustrator.

Two modes per logo:
  - color   : full multi-color trace (8 colors, smooth)
  - poster  : flat 4-color poster (better for App Store icon at small px)
"""
from __future__ import annotations

from pathlib import Path

import vtracer

ROOT = Path(__file__).resolve().parent.parent / "resources" / "logo-options"

# Final winner: the sketched-hat + colored-atom take.
PICKS = [
    "B-vector-sketched-hat-01",
]

COLOR_OPTS = dict(
    colormode="color",
    hierarchical="stacked",
    mode="spline",
    filter_speckle=8,
    color_precision=6,
    layer_difference=14,
    corner_threshold=60,
    length_threshold=4.0,
    splice_threshold=45,
    path_precision=6,
)

POSTER_OPTS = dict(
    colormode="color",
    hierarchical="stacked",
    mode="polygon",
    filter_speckle=20,
    color_precision=4,
    layer_difference=24,
    corner_threshold=80,
    length_threshold=6.0,
    splice_threshold=60,
    path_precision=3,
)


def trace(slug: str) -> None:
    src = ROOT / f"{slug}.png"
    if not src.exists():
        print(f"  skip: {src} not found")
        return
    color_dst = ROOT / f"{slug}.svg"
    poster_dst = ROOT / f"{slug}.poster.svg"
    print(f"  -> {color_dst.name} (smooth multi-color trace)")
    vtracer.convert_image_to_svg_py(str(src), str(color_dst), **COLOR_OPTS)
    print(f"  -> {poster_dst.name} (flat poster trace, fewer colors)")
    vtracer.convert_image_to_svg_py(str(src), str(poster_dst), **POSTER_OPTS)


def main():
    print(f"[fn-logo trace] vector pass over top {len(PICKS)} picks")
    for slug in PICKS:
        print(f"\n{slug}")
        trace(slug)
    print(f"\ndone. SVGs in {ROOT}")


if __name__ == "__main__":
    main()
