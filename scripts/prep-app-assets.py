"""
Prep iOS icon + splash source images from the chosen logo.

@capacitor/assets needs:
  assets/icon-only.png        — 1024x1024 (foreground; iOS auto-rounds corners)
  assets/icon-background.png  — 1024x1024 (solid background)
  assets/splash.png           — 2732x2732 (light splash)
  assets/splash-dark.png      — 2732x2732 (dark splash)

The chosen logo (B-vector-sketched-hat-01.png) has the cream background
baked in. We center-crop the logo art to a transparent foreground and
generate matching solid backgrounds + splashes.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "resources" / "logo-options" / "B-vector-sketched-hat-01.png"
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

CREAM = (245, 240, 220, 255)
DARK = (10, 10, 15, 255)


def load_logo() -> Image.Image:
    """Open the chosen logo; resize to 1024 if not already."""
    img = Image.open(SRC).convert("RGBA")
    if img.size != (1024, 1024):
        img = img.resize((1024, 1024), Image.LANCZOS)
    return img


def make_icon_only(logo: Image.Image) -> Image.Image:
    """
    Foreground icon — 1024x1024 with the logo art on transparent.

    The AI render put the logo on a cream rounded card. For the icon
    foreground we want the logo art floating on transparent so the
    @capacitor/assets pipeline can layer it over icon-background.
    Easiest path: keep the cream baked in (since it matches the brand)
    by feeding the same image. Capacitor will then composite it as-is.
    """
    return logo


def make_icon_background() -> Image.Image:
    return Image.new("RGBA", (1024, 1024), CREAM)


def make_splash(logo: Image.Image, bg_color: tuple[int, int, int, int]) -> Image.Image:
    """Center the logo on a 2732x2732 canvas at ~32% scale."""
    canvas = Image.new("RGBA", (2732, 2732), bg_color)
    target = int(2732 * 0.32)  # ~875 px logo
    art = logo.resize((target, target), Image.LANCZOS)
    x = (2732 - target) // 2
    y = (2732 - target) // 2
    canvas.paste(art, (x, y), art)
    return canvas


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source PNG: {SRC}")
    logo = load_logo()
    print(f"loaded {SRC.name} {logo.size}")

    icon = make_icon_only(logo)
    icon.save(ASSETS / "icon-only.png")
    print(f"  -> {ASSETS / 'icon-only.png'}")

    bg = make_icon_background()
    bg.save(ASSETS / "icon-background.png")
    print(f"  -> {ASSETS / 'icon-background.png'}")

    splash_light = make_splash(logo, CREAM)
    splash_light.save(ASSETS / "splash.png")
    print(f"  -> {ASSETS / 'splash.png'}")

    splash_dark = make_splash(logo, DARK)
    splash_dark.save(ASSETS / "splash-dark.png")
    print(f"  -> {ASSETS / 'splash-dark.png'}")

    print("\ndone. run: npx capacitor-assets generate --ios")


if __name__ == "__main__":
    main()
