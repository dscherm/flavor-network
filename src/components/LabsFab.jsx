/**
 * LabsFab — floating chalkboard "Labs ⌄" pill in the bottom-right.
 * (B-version cross-screen nav per user ask 2026-06-03.)
 *
 * Always visible on top of the main app surfaces; auto-hides when a
 * higher-z modal is open (PairingMode at z-[80], picker modal at z-40)
 * via the `hidden` prop the parent sets. Tap → opens a slide-up
 * popover listing the labs. Each item closes the popover + fires its
 * onSelect handler so the parent can route however it wants
 * (setActiveTab for tab-based labs, setMoleculeLabOpen for the modal
 * Molecule Lab, etc.).
 *
 * Chalkboard-coherent: near-black pill, double chalk-rail border,
 * Caveat handwriting, chalk-dust text-shadow.
 */

import React, { useState, useEffect } from 'react';

const FONT_HAND = 'Caveat, cursive';
const CHALK_CREAM = '#f5efde';
const CHALK_DIM = '#bdb6a3';
const CHALK_TEXT_SHADOW = '0 0 1px rgba(245,239,222,0.55), 0 0 3px rgba(245,239,222,0.22)';

const DEFAULT_LABS = [
  { id: 'cookbook', label: 'Cookbook',    desc: 'Browse saved recipes' },
  { id: 'cocktail', label: 'Cocktail Lab',desc: 'Mix a drink' },
  { id: 'sauce',    label: 'Sauce Lab',   desc: 'Build a sauce' },
  { id: 'molecule', label: 'Molecule Lab',desc: 'Inspect a compound' },
  // Profile relocated here per user 2026-06-03 (bottom-bar 4th slot is
  // now Recipe Notebook).
  { id: 'profile',  label: 'Profile',     desc: 'Saved recipes & insights' },
];

export default function LabsFab({
  labs = DEFAULT_LABS,
  hidden = false,
  onSelectLab,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 pointer-events-none"
      data-testid="labs-fab"
    >
      {open && (
        <div
          className="rounded-2xl px-2 py-2 pointer-events-auto"
          style={{
            background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 75%, #050505 100%), #0a0a0a',
            border: `2px double #4a4a4a`,
            boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 10px 28px rgba(0,0,0,0.65)',
            minWidth: 220,
          }}
          data-testid="labs-fab-popover"
        >
          {labs.map((lab) => (
            <button
              key={lab.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelectLab?.(lab.id);
              }}
              data-testid={`labs-fab-item-${lab.id}`}
              className="w-full flex flex-col items-start text-left px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
              style={{ minHeight: 44 }}
            >
              <span
                style={{
                  color: CHALK_CREAM,
                  fontFamily: FONT_HAND,
                  fontSize: 18,
                  textShadow: CHALK_TEXT_SHADOW,
                  lineHeight: 1.1,
                }}
              >
                {lab.label}
              </span>
              <span
                style={{
                  color: CHALK_DIM,
                  fontFamily: FONT_HAND,
                  fontSize: 13,
                  textShadow: CHALK_TEXT_SHADOW,
                  lineHeight: 1.1,
                }}
              >
                {lab.desc}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="labs-fab-toggle"
        aria-label={open ? 'Close labs menu' : 'Open labs menu'}
        aria-expanded={open ? 'true' : 'false'}
        className="rounded-full pointer-events-auto"
        style={{
          padding: '10px 18px',
          background: 'radial-gradient(ellipse at center, #1c1c1c 0%, #0a0a0a 100%), #0a0a0a',
          border: `2px double #4a4a4a`,
          boxShadow: 'inset 0 0 0 1px #6a6a6a55, 0 8px 24px rgba(0,0,0,0.55)',
          color: CHALK_CREAM,
          fontFamily: FONT_HAND,
          fontSize: 18,
          textShadow: CHALK_TEXT_SHADOW,
          minHeight: 44,
          letterSpacing: '0.02em',
        }}
      >
        🔬 Labs {open ? '×' : '⌄'}
      </button>
    </div>
  );
}

export { DEFAULT_LABS };
