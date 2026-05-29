import { describe, it, expect } from 'vitest';
import {
  BRISCIONE_AROMA,
  BRISCIONE_TASTE,
  axisOrder,
  bucketColor,
  AROMA_LABEL_TO_GNN_KEY,
  GNN_KEY_TO_AROMA_LABEL,
} from '../briscionePalette.js';

describe('briscionePalette — chef-canonical axis vocab', () => {
  it('axisOrder(aroma) returns the 13 chef-canonical aromas', () => {
    expect(axisOrder('aroma')).toEqual([
      'citrus', 'fruity', 'floral', 'herbal', 'green', 'creamy',
      'woody', 'earthy', 'roasted', 'caramel', 'fermented', 'marine', 'pungent',
    ]);
  });

  it('axisOrder(taste) returns the 8 chef-canonical tastes', () => {
    expect(axisOrder('taste')).toEqual([
      'sweet', 'sour', 'bitter', 'salty', 'spicy', 'pungent', 'astringent', 'umami',
    ]);
  });

  it('every aroma label has a Briscione color', () => {
    for (const label of axisOrder('aroma')) {
      expect(BRISCIONE_AROMA[label]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(bucketColor('aroma', label)).toBe(BRISCIONE_AROMA[label]);
    }
  });

  it('every taste label has a Briscione color', () => {
    for (const label of axisOrder('taste')) {
      expect(BRISCIONE_TASTE[label]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('AROMA_LABEL_TO_GNN_KEY maps exactly the 5 GNN-pickable labels', () => {
    expect(Object.keys(AROMA_LABEL_TO_GNN_KEY).sort()).toEqual(
      ['creamy', 'floral', 'fruity', 'green', 'woody'],
    );
  });

  it('AROMA_LABEL_TO_GNN_KEY values are the canonical GNN column keys', () => {
    expect(AROMA_LABEL_TO_GNN_KEY.fruity).toBe('odor_fruity');
    expect(AROMA_LABEL_TO_GNN_KEY.floral).toBe('odor_floral');
    expect(AROMA_LABEL_TO_GNN_KEY.green).toBe('odor_green');
    expect(AROMA_LABEL_TO_GNN_KEY.woody).toBe('odor_woody');
    // creamy is the chef-renamed label; the underlying GNN column kept
    // the legacy `odor_fatty` name (2026-05-27 chef-vocab batch 6).
    expect(AROMA_LABEL_TO_GNN_KEY.creamy).toBe('odor_fatty');
  });

  it('GNN_KEY_TO_AROMA_LABEL is the inverse of AROMA_LABEL_TO_GNN_KEY', () => {
    for (const [label, key] of Object.entries(AROMA_LABEL_TO_GNN_KEY)) {
      expect(GNN_KEY_TO_AROMA_LABEL[key]).toBe(label);
    }
  });

  it('8 chef-only aromas have no GNN key mapping (chef-tier1-only)', () => {
    const chefOnly = ['citrus', 'herbal', 'earthy', 'roasted', 'caramel', 'fermented', 'marine', 'pungent'];
    for (const label of chefOnly) {
      expect(axisOrder('aroma')).toContain(label);
      expect(AROMA_LABEL_TO_GNN_KEY[label]).toBeUndefined();
    }
  });

  it('bucketColor returns a slate fallback for unknown axes', () => {
    expect(bucketColor('unknown-axis', 'whatever')).toBe('#64748b');
  });
});
