import { describe, it, expect } from 'vitest';
import data from '../../../public/proDataset/flavor_cluster_labels.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// CIE-Lab ΔE76 helpers (inline — no external dep needed for this gate)
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function linearize(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function rgbToXyz(r, g, b) {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b);
  return [
    lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  ];
}
function xyzToLab([x, y, z]) {
  const xn = 0.95047, yn = 1.0, zn = 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116);
  const fx = f(x / xn), fy = f(y / yn), fz = f(z / zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function hexToLab(hex) { return xyzToLab(rgbToXyz(...hexToRgb(hex))); }
function deltaE76(h1, h2) {
  const [L1, a1, b1] = hexToLab(h1), [L2, a2, b2] = hexToLab(h2);
  return Math.sqrt((L1 - L2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

describe('flavor_cluster_labels.json — data integrity', () => {
  const clusters = data?.clusters ?? [];

  it('has exactly 12 clusters', () => {
    expect(clusters.length).toBe(12);
  });

  it('every cluster has a unique id (0..N-1, integer)', () => {
    const ids = clusters.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(Number.isInteger(id)).toBe(true));
  });

  it('every cluster label is a non-empty string and pairwise distinct (P0 gate)', () => {
    const labels = clusters.map((c) => c.label);
    labels.forEach((l) => {
      expect(typeof l).toBe('string');
      expect(l.length).toBeGreaterThan(0);
    });
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every cluster has a 3D centroid stored as `centroid_3d` (NOT bare `centroid`)', () => {
    clusters.forEach((c) => {
      expect(Array.isArray(c.centroid_3d)).toBe(true);
      expect(c.centroid_3d.length).toBe(3);
      c.centroid_3d.forEach((n) => expect(typeof n).toBe('number'));
      expect(c.centroid).toBeUndefined();
    });
  });
});

describe('cluster colors — P2', () => {
  const clusters = data?.clusters ?? [];

  it('every cluster has a color field matching #RRGGBB format', () => {
    clusters.forEach((c) => {
      expect(typeof c.color).toBe('string');
      expect(c.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('all 12 cluster colors are pairwise CIE-Lab ΔE76 > 15', () => {
    const colors = clusters.map((c) => c.color);
    const failures = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const de = deltaE76(colors[i], colors[j]);
        if (de <= 15) {
          failures.push(
            `id${clusters[i].id}(${colors[i]}) vs id${clusters[j].id}(${colors[j]}): ΔE=${de.toFixed(2)}`
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
