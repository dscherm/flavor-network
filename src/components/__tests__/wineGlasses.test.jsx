// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { WineGlass, WINE_FAMILY_GLASS, WINE_GLASS_SHAPES, wineGlassShape } from '../wineGlasses.jsx';
import { CocktailFamilyGlass, DrinkGlass, glassTypeFor } from '../cocktailGlasses.jsx';

afterEach(cleanup);

const WINE_JSON = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/wine_styles.json'), 'utf8'));
const FAMILIES = WINE_JSON._meta.families;

// The widest x-span of a bowl outline (numbers at even positions are x).
function bowlWidth(d) {
  const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  return Math.max(...xs) - Math.min(...xs);
}

describe('WineGlass', () => {
  it('every wine family in the data has its own glass drawing', () => {
    for (const fam of FAMILIES) {
      expect(WINE_FAMILY_GLASS[fam.id], fam.id).toBeTruthy();
      render(<WineGlass family={fam.id} color={fam.color} />);
      const svg = screen.getByTestId(`wine-glass-${fam.id}`);
      expect(svg.tagName.toLowerCase()).toBe('svg');
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.dataset.glass).toBe(WINE_FAMILY_GLASS[fam.id]);
      // filled with the family colour as wine
      expect(svg.querySelector('[data-part="wine"]').getAttribute('fill')).toBe(fam.color);
    }
  });

  it('uses the right shape per family', () => {
    expect(wineGlassShape('sparkling')).toBe('flute');
    expect(wineGlassShape('rose')).toBe('rose');
    expect(wineGlassShape('sweet')).toBe('dessert');
    expect(wineGlassShape('fortified')).toBe('copita');
    expect(wineGlassShape('crisp-white')).toBe('white');
    expect(wineGlassShape('nonsense')).toBe('white');
  });

  it('the red bowl grows from light to full', () => {
    const w = (k) => bowlWidth(WINE_GLASS_SHAPES[k].bowl);
    expect(w('red-light')).toBeLessThan(w('red-medium'));
    expect(w('red-medium')).toBeLessThan(w('red-full'));
  });

  it('the sparkling flute has bubbles; a dashed glass draws a dashed bowl', () => {
    render(<WineGlass family="sparkling" color="#fde68a" dashed />);
    const svg = screen.getByTestId('wine-glass-sparkling');
    expect(svg.querySelectorAll('circle').length).toBeGreaterThan(0);
    expect(svg.querySelector('[stroke-dasharray]')).toBeTruthy();
  });
});

describe('CocktailFamilyGlass', () => {
  const families = [
    ['Tropical Sours', 'pilsner'], ['Highballs & Fizzes', 'snifter'], ['Sour Family', 'margarita'],
    ['Boozy Sippers', 'rocks'], ['Aromatic Stirred', 'martini'], ['Aperitivos', 'wine'],
  ];
  it('each cocktail family draws its signature glass, aria-hidden', () => {
    for (const [name, type] of families) {
      expect(glassTypeFor(name)).toBe(type);
      render(<CocktailFamilyGlass familyName={name} color="#a16207" testid={`g-${type}`} />);
      const svg = screen.getByTestId(`g-${type}`);
      expect(svg.dataset.glass).toBe(type);
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('DrinkGlass fills with the drink colour and skips unknown families', () => {
    const fams = new Map([[5, { id: 5, name: 'Aperitivos', color: '#be185d' }]]);
    const negroni = { name: 'Negroni', family_id: 5, ingredients_raw: [{ raw: '1 oz Gin' }, { raw: '1 oz Campari' }] };
    const { container } = render(<DrinkGlass cocktail={negroni} familyById={fams} />);
    expect(container.querySelector('[data-part="liquid"]').getAttribute('fill')).toBe('#c8102e');
    cleanup();
    const { container: c2 } = render(<DrinkGlass cocktail={{ ...negroni, family_id: 99 }} familyById={fams} />);
    expect(c2.innerHTML).toBe('');
  });
});
