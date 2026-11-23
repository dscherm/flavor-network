"""Builds the two "Alegreya Sans Lining" woff files the share cards are drawn in (LOOK-6b).

Alegreya Sans draws oldstyle figures by default and a canvas cannot ask for lining ones, so the
digits are remapped to the lining tabular glyphs the font already has (zero.tf .. nine.tf) and the
family is renamed. Only the cmap entries for U+0030-0039 and the name table change; no glyph is
added or removed. woff, not woff2, because satori reads woff/ttf/otf only.

Run by hand when the @fontsource/alegreya-sans version changes:
    python scripts/buildLiningFont.py
Writes public/fonts/ (source of truth for the browser) and functions/fonts/ (for the Cloud
Function), plus LICENSE-alegreya-sans.txt (SIL OFL 1.1, from the package) beside each copy.
"""
import shutil
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules' / '@fontsource' / 'alegreya-sans'
OUTS = [ROOT / 'public' / 'fonts', ROOT / 'functions' / 'fonts']
DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']


def build(weight):
    f = TTFont(SRC / 'files' / f'alegreya-sans-latin-{weight}-normal.woff')
    glyphs = set(f.getGlyphOrder())
    for table in f['cmap'].tables:
        if table.isUnicode():
            for i, name in enumerate(DIGITS):
                if 0x30 + i in table.cmap and f'{name}.tf' in glyphs:
                    table.cmap[0x30 + i] = f'{name}.tf'
    for rec in f['name'].names:
        s = rec.toUnicode()
        if 'Alegreya Sans' in s and rec.nameID in (1, 3, 4, 6, 16):
            rec.string = s.replace('Alegreya Sans', 'Alegreya Sans Lining').replace('AlegreyaSans', 'AlegreyaSansLining')
    f.flavor = 'woff'
    return f


for out in OUTS:
    out.mkdir(parents=True, exist_ok=True)
    for weight in (400, 500):
        dst = out / f'alegreya-sans-lining-latin-{weight}-normal.woff'
        build(weight).save(dst)
        print('wrote', dst.relative_to(ROOT), dst.stat().st_size, 'bytes')
    shutil.copyfile(SRC / 'LICENSE', out / 'LICENSE-alegreya-sans.txt')
