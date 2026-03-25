import { useRef, useCallback } from 'react';

/** Canvas roundRect polyfill for browsers that lack ctx.roundRect(). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * CocktailCard — Exportable cocktail card rendered as a styled div.
 * Download as PNG using html2canvas-style approach (renders to canvas).
 */
export default function CocktailCard({ cocktail, compatibilityScore, codexTemplate, onClose }) {
  const cardRef = useRef(null);

  const handleDownload = useCallback(async () => {
    const card = cardRef.current;
    if (!card) return;

    // Use canvas rendering
    const canvas = document.createElement('canvas');
    const scale = 2; // Retina
    canvas.width = 600 * scale;
    canvas.height = 800 * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, 800);
    gradient.addColorStop(0, '#12121a');
    gradient.addColorStop(1, '#0a0a14');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 800);

    // Border
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    roundRect(ctx, 10, 10, 580, 780, 16);
    ctx.stroke();

    // Purple accent line
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.lineTo(560, 80);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#e5e7eb';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cocktail.name || 'Untitled Cocktail', 300, 55);

    // Template badge
    let yPos = 110;
    if (codexTemplate) {
      ctx.fillStyle = '#7c3aed40';
      const badgeText = `${codexTemplate.name} (${codexTemplate.confidence}%)`;
      const metrics = ctx.measureText(badgeText);
      const bw = metrics.width + 24;
      roundRect(ctx, 300 - bw / 2, yPos - 14, bw, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#a78bfa';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText(badgeText, 300, yPos + 2);
      yPos += 40;
    }

    // Compatibility score
    if (compatibilityScore > 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMPATIBILITY', 300, yPos);
      yPos += 20;

      // Score bar
      const barWidth = 200;
      const barX = 300 - barWidth / 2;
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, barX, yPos - 4, barWidth, 8, 4);
      ctx.fill();

      const scoreColor = compatibilityScore > 7 ? '#4ade80' : compatibilityScore > 4 ? '#facc15' : '#f87171';
      ctx.fillStyle = scoreColor;
      roundRect(ctx, barX, yPos - 4, barWidth * Math.min(1, compatibilityScore / 10), 8, 4);
      ctx.fill();

      ctx.fillStyle = scoreColor;
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${compatibilityScore.toFixed(1)}/10`, 300, yPos + 24);
      yPos += 50;
    }

    // Ingredients header
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('INGREDIENTS', 60, yPos);
    yPos += 20;

    // Ingredient list
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    const ingredients = cocktail.ingredients || [];
    for (const ing of ingredients) {
      // Dot
      ctx.fillStyle = '#7c3aed80';
      ctx.beginPath();
      ctx.arc(68, yPos - 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Name
      ctx.fillStyle = '#d1d5db';
      ctx.textAlign = 'left';
      ctx.fillText(ing.name, 82, yPos);

      // Measure
      if (ing.measure || ing.quantity) {
        ctx.fillStyle = '#6b7280';
        ctx.textAlign = 'right';
        const measure = ing.measure || `${ing.quantity || ''} ${ing.unit || ''}`.trim();
        ctx.fillText(measure, 540, yPos);
      }

      yPos += 26;
    }

    // Instructions
    if (cocktail.instructions) {
      yPos += 10;
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('INSTRUCTIONS', 60, yPos);
      yPos += 18;

      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px system-ui, -apple-system, sans-serif';

      // Word wrap
      const words = cocktail.instructions.split(' ');
      let line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 480) {
          ctx.fillText(line.trim(), 60, yPos);
          line = word + ' ';
          yPos += 18;
          if (yPos > 720) break;
        } else {
          line = test;
        }
      }
      if (line.trim() && yPos <= 720) {
        ctx.fillText(line.trim(), 60, yPos);
      }
    }

    // Footer
    ctx.fillStyle = '#4b5563';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Created with Flavor Network · Cocktail Lab', 300, 770);

    // Download
    const link = document.createElement('a');
    link.download = `${(cocktail.name || 'cocktail').replace(/\s+/g, '-').toLowerCase()}-card.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [cocktail, compatibilityScore, codexTemplate]);

  if (!cocktail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-4 max-w-md w-full mx-4">
        {/* Preview card */}
        <div ref={cardRef} className="bg-gradient-to-b from-[#12121a] to-[#0a0a14] border border-[#2a2a3e] rounded-lg p-6 mb-4">
          <h3 className="text-lg font-bold text-gray-200 text-center mb-2">
            {cocktail.name || 'Untitled Cocktail'}
          </h3>

          {codexTemplate && (
            <div className="text-center mb-3">
              <span className="text-[10px] text-purple-400 bg-purple-500/20 rounded px-2 py-0.5">
                {codexTemplate.name} ({codexTemplate.confidence}%)
              </span>
            </div>
          )}

          {compatibilityScore > 0 && (
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-2">
                <span className="text-[9px] text-gray-600 uppercase">Compatibility</span>
                <div className="w-24 h-1.5 bg-[#1a1a2e] rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, compatibilityScore * 10)}%`,
                      backgroundColor: compatibilityScore > 7 ? '#4ade80' : compatibilityScore > 4 ? '#facc15' : '#f87171',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-400">{compatibilityScore.toFixed(1)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1 mb-3">
            {(cocktail.ingredients || []).map((ing, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{ing.name}</span>
                <span className="text-gray-600">{ing.measure || `${ing.quantity || ''} ${ing.unit || ''}`.trim() || ''}</span>
              </div>
            ))}
          </div>

          <p className="text-[8px] text-gray-700 text-center mt-4">
            Created with Flavor Network - Cocktail Lab
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg py-2 transition-colors"
          >
            Download PNG
          </button>
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-300 py-2 px-3 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
