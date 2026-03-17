import { useState, useEffect, useRef } from 'react';

const FONT = 'Caveat, cursive';
const PENCIL = '#5a4a2a';
const PENCIL_LIGHT = '#8a7a5a';
const BG = '#fefae0';

// ─── Cocktail Codex structures ───
const COCKTAIL_STRUCTURES = [
  { key: 'old-fashioned', label: 'Old Fashioned', desc: 'Spirit + Sugar + Bitters',
    icon: (ctx, x, y) => { // rocks glass
      ctx.beginPath(); ctx.moveTo(x-7, y-6); ctx.lineTo(x-9, y+7); ctx.lineTo(x+9, y+7); ctx.lineTo(x+7, y-6); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-6, y+1); ctx.lineTo(x+6, y+1); ctx.stroke(); // liquid line
    }},
  { key: 'martini', label: 'Martini', desc: 'Spirit + Vermouth',
    icon: (ctx, x, y) => { // martini glass
      ctx.beginPath(); ctx.moveTo(x-9, y-7); ctx.lineTo(x, y+2); ctx.lineTo(x+9, y-7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y+2); ctx.lineTo(x, y+8); ctx.stroke(); // stem
      ctx.beginPath(); ctx.moveTo(x-5, y+8); ctx.lineTo(x+5, y+8); ctx.stroke(); // base
    }},
  { key: 'daiquiri', label: 'Daiquiri', desc: 'Spirit + Citrus + Sugar',
    icon: (ctx, x, y) => { // coupe glass
      ctx.beginPath(); ctx.arc(x, y-2, 8, 0.15, Math.PI-0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y+6); ctx.lineTo(x, y+9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-4, y+9); ctx.lineTo(x+4, y+9); ctx.stroke();
    }},
  { key: 'sidecar', label: 'Sidecar', desc: 'Spirit + Liqueur + Citrus',
    icon: (ctx, x, y) => { // coupe with sugar rim
      ctx.beginPath(); ctx.arc(x, y-2, 8, 0.15, Math.PI-0.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y+6); ctx.lineTo(x, y+9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-4, y+9); ctx.lineTo(x+4, y+9); ctx.stroke();
      // sugar rim dots
      for (let a = 0.15; a < Math.PI-0.15; a += 0.35) {
        const rx = x + Math.cos(a) * 8.5; const ry = (y-2) + Math.sin(a) * 8.5;
        ctx.beginPath(); ctx.arc(rx, ry, 0.8, 0, Math.PI*2); ctx.fill();
      }
    }},
  { key: 'highball', label: 'Highball', desc: 'Spirit + Lengthener',
    icon: (ctx, x, y) => { // tall glass
      ctx.beginPath(); ctx.rect(x-5, y-8, 10, 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-4, y+2); ctx.lineTo(x+4, y+2); ctx.stroke(); // liquid
      // bubbles
      ctx.beginPath(); ctx.arc(x-1, y+5, 1, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x+2, y+3, 1, 0, Math.PI*2); ctx.stroke();
    }},
  { key: 'flip', label: 'Flip', desc: 'Spirit + Sugar + Egg',
    icon: (ctx, x, y) => { // wine glass shape
      ctx.beginPath(); ctx.ellipse(x, y-3, 7, 6, 0, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y+3); ctx.lineTo(x, y+8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-4, y+8); ctx.lineTo(x+4, y+8); ctx.stroke();
    }},
];

// ─── Mother Sauce structures ───
const SAUCE_STRUCTURES = [
  { key: 'bechamel', label: 'Béchamel', desc: 'Roux + Milk',
    icon: (ctx, x, y) => { // pot
      ctx.beginPath(); ctx.rect(x-7, y-3, 14, 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-7, y-3); ctx.quadraticCurveTo(x, y-8, x+7, y-3); ctx.stroke(); // lid
      ctx.beginPath(); ctx.moveTo(x, y-8); ctx.lineTo(x, y-10); ctx.stroke(); // handle
    }},
  { key: 'veloute', label: 'Velouté', desc: 'Roux + Stock',
    icon: (ctx, x, y) => { // ladle
      ctx.beginPath(); ctx.arc(x, y+2, 6, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+6, y+2); ctx.quadraticCurveTo(x+10, y-5, x+7, y-9); ctx.stroke();
    }},
  { key: 'espagnole', label: 'Espagnole', desc: 'Roux + Stock + Mirepoix',
    icon: (ctx, x, y) => { // deep pot
      ctx.beginPath(); ctx.moveTo(x-7, y-5); ctx.lineTo(x-8, y+6); ctx.lineTo(x+8, y+6); ctx.lineTo(x+7, y-5); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-9, y-3); ctx.lineTo(x-7, y-3); ctx.stroke(); // handle L
      ctx.beginPath(); ctx.moveTo(x+7, y-3); ctx.lineTo(x+9, y-3); ctx.stroke(); // handle R
    }},
  { key: 'tomato', label: 'Tomato', desc: 'Tomato + Aromatics + Herbs',
    icon: (ctx, x, y) => { // tomato
      ctx.beginPath(); ctx.arc(x, y+1, 7, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-2, y-6); ctx.quadraticCurveTo(x, y-9, x+2, y-6); ctx.stroke(); // stem
    }},
  { key: 'hollandaise', label: 'Hollandaise', desc: 'Butter + Egg + Acid',
    icon: (ctx, x, y) => { // whisk
      ctx.beginPath(); ctx.moveTo(x, y+8); ctx.lineTo(x, y-2); ctx.stroke(); // handle
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x, y-2);
        ctx.quadraticCurveTo(x + i*3, y-7, x + i*1.5, y-10); ctx.stroke();
      }
    }},
  { key: 'curry', label: 'Curry', desc: 'Fat + Aromatics + Spices',
    icon: (ctx, x, y) => { // bowl with steam
      ctx.beginPath(); ctx.arc(x, y+2, 8, Math.PI*0.05, Math.PI*0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-8, y+2); ctx.lineTo(x+8, y+2); ctx.stroke();
      // steam
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(x+i*3, y-2);
        ctx.quadraticCurveTo(x+i*3+1.5, y-5, x+i*3, y-7); ctx.stroke();
      }
    }},
  { key: 'stir-fry', label: 'Stir-fry', desc: 'Soy/Fish Sauce + Aromatics',
    icon: (ctx, x, y) => { // wok
      ctx.beginPath(); ctx.arc(x, y+3, 9, Math.PI*0.1, Math.PI*0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+9, y+1); ctx.lineTo(x+12, y-2); ctx.stroke(); // handle
    }},
  { key: 'mole', label: 'Mole', desc: 'Chilies + Spices + Chocolate',
    icon: (ctx, x, y) => { // mortar & pestle
      ctx.beginPath(); ctx.arc(x, y+2, 8, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-8, y+2); ctx.lineTo(x+8, y+2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+3, y+1); ctx.lineTo(x+8, y-8); ctx.stroke(); // pestle
      ctx.beginPath(); ctx.arc(x+8.5, y-9, 2, 0, Math.PI*2); ctx.stroke();
    }},
  { key: 'salsa', label: 'Salsa', desc: 'Tomato + Chili + Herbs',
    icon: (ctx, x, y) => { // pepper/chili
      ctx.beginPath(); ctx.moveTo(x-1, y-8);
      ctx.quadraticCurveTo(x-7, y-2, x-4, y+6);
      ctx.quadraticCurveTo(x, y+9, x+2, y+6);
      ctx.quadraticCurveTo(x+5, y, x-1, y-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x-1, y-8); ctx.lineTo(x+1, y-10); ctx.stroke(); // stem
    }},
  { key: 'nut-sauce', label: 'Nut Sauce', desc: 'Peanut/Tahini + Acid',
    icon: (ctx, x, y) => { // peanut shape
      ctx.beginPath(); ctx.ellipse(x, y-3, 4, 5, 0, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y+4, 4, 4, 0, 0, Math.PI*2); ctx.stroke();
    }},
];

export const STRUCTURES = {
  cocktail: COCKTAIL_STRUCTURES,
  sauce: SAUCE_STRUCTURES,
};

export default function StructureSelector({ mode, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const canvasRefs = useRef({});

  const structures = mode === 'cocktail' ? COCKTAIL_STRUCTURES : SAUCE_STRUCTURES;
  const title = mode === 'cocktail' ? 'Cocktail Structure' : 'Mother Sauces';
  const selectedItem = structures.find(s => s.key === selected);

  // Click-outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Draw icons on small canvases
  useEffect(() => {
    for (const s of structures) {
      const canvas = canvasRefs.current[s.key];
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = 24 * dpr;
      canvas.height = 24 * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 24, 24);
      ctx.strokeStyle = PENCIL_LIGHT;
      ctx.fillStyle = PENCIL_LIGHT;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      s.icon(ctx, 12, 12);
    }
  }, [structures, open]);

  return (
    <div ref={containerRef} className="relative" style={{ fontFamily: FONT }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
        style={{
          borderColor: '#c9b99a',
          backgroundColor: open ? '#f5edd0' : 'transparent',
          color: PENCIL,
        }}
      >
        {selectedItem && (
          <canvas
            ref={el => { if (el) canvasRefs.current[selectedItem.key] = el; }}
            width={24} height={24}
            style={{ width: 20, height: 20 }}
          />
        )}
        <span className="text-base">
          {selectedItem ? selectedItem.label : title}
        </span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: PENCIL_LIGHT }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-lg border shadow-lg z-30 overflow-hidden"
          style={{ borderColor: '#c9b99a', backgroundColor: BG }}
        >
          {/* No structure (clear) */}
          <button
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              !selected ? 'bg-[#f0e8d0]' : 'hover:bg-[#f5edd0]'
            }`}
            style={{ color: PENCIL }}
          >
            <span className="w-5 h-5 flex items-center justify-center text-sm" style={{ color: PENCIL_LIGHT }}>—</span>
            <div>
              <div className="text-base">Free form</div>
              <div className="text-xs" style={{ color: PENCIL_LIGHT }}>No structure template</div>
            </div>
          </button>

          {structures.map((s) => (
            <button
              key={s.key}
              onClick={() => { onSelect(s.key); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                selected === s.key ? 'bg-[#f0e8d0]' : 'hover:bg-[#f5edd0]'
              }`}
              style={{ color: PENCIL }}
            >
              <canvas
                ref={el => { if (el) canvasRefs.current[s.key] = el; }}
                width={24} height={24}
                style={{ width: 20, height: 20, flexShrink: 0 }}
              />
              <div className="min-w-0">
                <div className="text-base">{s.label}</div>
                <div className="text-xs truncate" style={{ color: PENCIL_LIGHT }}>{s.desc}</div>
              </div>
              {selected === s.key && (
                <svg className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: '#6a8a4a' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
