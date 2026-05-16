import { describe, it, expect } from 'vitest';
import {
  isAllowedUnder,
  passesDietaryFilters,
  DIETARY_RESTRICTIONS,
} from '../dietaryFilters.js';

describe('dietaryFilters', () => {
  describe('vegetarian', () => {
    it('excludes meat + poultry', () => {
      expect(isAllowedUnder('vegetarian', 'beef')).toBe(false);
      expect(isAllowedUnder('vegetarian', 'chicken breast')).toBe(false);
      expect(isAllowedUnder('vegetarian', 'pork sausage')).toBe(false);
    });
    it('excludes seafood', () => {
      expect(isAllowedUnder('vegetarian', 'salmon')).toBe(false);
      expect(isAllowedUnder('vegetarian', 'shrimp')).toBe(false);
    });
    it('allows plant + dairy + egg', () => {
      expect(isAllowedUnder('vegetarian', 'tofu')).toBe(true);
      expect(isAllowedUnder('vegetarian', 'milk', { category: 'dairy' })).toBe(true);
      expect(isAllowedUnder('vegetarian', 'egg')).toBe(true);
      expect(isAllowedUnder('vegetarian', 'tomato')).toBe(true);
    });
  });

  describe('vegan', () => {
    it('excludes meat + dairy + egg + honey', () => {
      expect(isAllowedUnder('vegan', 'beef')).toBe(false);
      expect(isAllowedUnder('vegan', 'milk', { category: 'dairy' })).toBe(false);
      expect(isAllowedUnder('vegan', 'cheddar')).toBe(false);
      expect(isAllowedUnder('vegan', 'egg')).toBe(false);
      expect(isAllowedUnder('vegan', 'honey')).toBe(false);
    });
    it('allows plant ingredients', () => {
      expect(isAllowedUnder('vegan', 'tofu')).toBe(true);
      expect(isAllowedUnder('vegan', 'tomato')).toBe(true);
      expect(isAllowedUnder('vegan', 'almond milk')).toBe(false); // contains 'milk' — conservative reject
    });
  });

  describe('gluten-free', () => {
    it('excludes wheat / barley / rye / bread / pasta', () => {
      expect(isAllowedUnder('gluten-free', 'wheat')).toBe(false);
      expect(isAllowedUnder('gluten-free', 'flour')).toBe(false);
      expect(isAllowedUnder('gluten-free', 'pasta')).toBe(false);
      expect(isAllowedUnder('gluten-free', 'beer')).toBe(false);
    });
    it('allows rice / corn / quinoa', () => {
      expect(isAllowedUnder('gluten-free', 'rice')).toBe(true);
      expect(isAllowedUnder('gluten-free', 'corn')).toBe(true);
      expect(isAllowedUnder('gluten-free', 'quinoa')).toBe(true);
    });
  });

  describe('dairy-free', () => {
    it('excludes milk / cheese / butter / cream', () => {
      expect(isAllowedUnder('dairy-free', 'milk', { category: 'dairy' })).toBe(false);
      expect(isAllowedUnder('dairy-free', 'cheddar')).toBe(false);
      expect(isAllowedUnder('dairy-free', 'butter')).toBe(false);
    });
    it('allows soy + nut milks', () => {
      // soy milk contains 'milk' substring — conservative reject; user
      // can deselect the filter or stack with vegan-allowed plants.
      expect(isAllowedUnder('dairy-free', 'tofu')).toBe(true);
      expect(isAllowedUnder('dairy-free', 'tomato')).toBe(true);
    });
  });

  describe('nut-free', () => {
    it('excludes tree nuts + peanut', () => {
      expect(isAllowedUnder('nut-free', 'almond')).toBe(false);
      expect(isAllowedUnder('nut-free', 'walnut')).toBe(false);
      expect(isAllowedUnder('nut-free', 'peanut')).toBe(false);
      expect(isAllowedUnder('nut-free', 'pine nut')).toBe(false);
    });
    it('allows coconut + seeds', () => {
      expect(isAllowedUnder('nut-free', 'coconut')).toBe(true);
      expect(isAllowedUnder('nut-free', 'sesame')).toBe(true);
    });
  });

  describe('pescatarian', () => {
    it('excludes meat / poultry, allows fish', () => {
      expect(isAllowedUnder('pescatarian', 'beef')).toBe(false);
      expect(isAllowedUnder('pescatarian', 'chicken')).toBe(false);
      expect(isAllowedUnder('pescatarian', 'salmon')).toBe(true);
      expect(isAllowedUnder('pescatarian', 'shrimp')).toBe(true);
    });
  });

  describe('kosher (approximate)', () => {
    it('excludes pork + shellfish', () => {
      expect(isAllowedUnder('kosher', 'pork')).toBe(false);
      expect(isAllowedUnder('kosher', 'bacon')).toBe(false);
      expect(isAllowedUnder('kosher', 'shrimp')).toBe(false);
      expect(isAllowedUnder('kosher', 'lobster')).toBe(false);
    });
    it('allows beef / chicken / fish / dairy', () => {
      expect(isAllowedUnder('kosher', 'beef')).toBe(true);
      expect(isAllowedUnder('kosher', 'chicken')).toBe(true);
      expect(isAllowedUnder('kosher', 'salmon')).toBe(true);
      expect(isAllowedUnder('kosher', 'cheddar')).toBe(true);
    });
  });

  describe('halal (approximate)', () => {
    it('excludes pork + alcohol', () => {
      expect(isAllowedUnder('halal', 'pork')).toBe(false);
      expect(isAllowedUnder('halal', 'wine')).toBe(false);
      expect(isAllowedUnder('halal', 'whiskey')).toBe(false);
    });
    it('allows beef / chicken / fish / dairy', () => {
      expect(isAllowedUnder('halal', 'beef')).toBe(true);
      expect(isAllowedUnder('halal', 'chicken')).toBe(true);
      expect(isAllowedUnder('halal', 'salmon')).toBe(true);
      expect(isAllowedUnder('halal', 'cheddar')).toBe(true);
    });
  });

  describe('passesDietaryFilters (combined)', () => {
    it('empty restrictions list always passes', () => {
      expect(passesDietaryFilters('beef', null, [])).toBe(true);
      expect(passesDietaryFilters('beef', null, undefined)).toBe(true);
    });
    it('combines AND-logic across restrictions', () => {
      // vegetarian + gluten-free: tofu allowed
      expect(passesDietaryFilters('tofu', null, ['vegetarian', 'gluten-free'])).toBe(true);
      // vegetarian + gluten-free: wheat blocked by gluten-free
      expect(passesDietaryFilters('wheat', null, ['vegetarian', 'gluten-free'])).toBe(false);
      // vegan + nut-free: almond blocked by nut-free
      expect(passesDietaryFilters('almond', null, ['vegan', 'nut-free'])).toBe(false);
    });
  });

  it('DIETARY_RESTRICTIONS exports the 8 canonical keys', () => {
    expect(DIETARY_RESTRICTIONS).toEqual([
      'vegetarian',
      'vegan',
      'gluten-free',
      'dairy-free',
      'nut-free',
      'pescatarian',
      'kosher',
      'halal',
    ]);
  });
});
