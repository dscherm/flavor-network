import { useCallback, useMemo, useRef } from 'react';
import { computeProfileWeights, getTasteSignature, getCuisineAffinity, getTopIngredients } from '../data/profileWeights.js';

/**
 * Generate Flavor Passport as a canvas, then export as PNG.
 */
function drawPassport(canvas, { topIngredients, tasteSignature, cuisineAffinity, stats }) {
  const ctx = canvas.getContext('2d');
  const W = 600;
  const H = 800;
  canvas.width = W;
  canvas.height = H;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0a14');
  bg.addColorStop(1, '#12121a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Border
  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Inner glow border
  ctx.strokeStyle = 'rgba(79, 143, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(15, 15, W - 30, H - 30);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Flavor Passport', W / 2, 55);

  ctx.fillStyle = 'rgba(79, 143, 255, 0.6)';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('FLAVOR NETWORK', W / 2, 75);

  // Divider
  ctx.strokeStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.moveTo(40, 90);
  ctx.lineTo(W - 40, 90);
  ctx.stroke();

  // Stats row
  ctx.textAlign = 'center';
  ctx.fillStyle = '#888';
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  const statLabels = ['Ingredients', 'Cuisines', 'Recipes'];
  const statValues = [stats.ingredientCount, stats.cuisineCount, stats.recipeCount];
  for (let i = 0; i < 3; i++) {
    const x = 100 + i * 200;
    ctx.fillStyle = '#4f8fff';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(String(statValues[i]), x, 125);
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(statLabels[i], x, 142);
  }

  // Divider
  ctx.strokeStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.moveTo(40, 160);
  ctx.lineTo(W - 40, 160);
  ctx.stroke();

  // Top Ingredients
  let y = 185;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(79, 143, 255, 0.5)';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('TOP INGREDIENTS', 40, y);
  y += 20;

  ctx.font = '12px system-ui, -apple-system, sans-serif';
  for (let i = 0; i < Math.min(topIngredients.length, 10); i++) {
    const ing = topIngredients[i];
    const barWidth = ing.weight * 200;

    // Bar background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(160, y - 10, 200, 14);

    // Bar fill
    ctx.fillStyle = `rgba(79, 143, 255, ${0.3 + ing.weight * 0.5})`;
    ctx.fillRect(160, y - 10, barWidth, 14);

    // Name
    ctx.fillStyle = '#ccc';
    ctx.fillText(ing.name, 40, y);

    // Weight %
    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${Math.round(ing.weight * 100)}%`, W - 40, y);
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';

    y += 22;
  }

  y += 10;

  // Divider
  ctx.strokeStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(W - 40, y);
  ctx.stroke();
  y += 20;

  // Taste Signature
  ctx.fillStyle = 'rgba(79, 143, 255, 0.5)';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('TASTE SIGNATURE', 40, y);
  y += 20;

  const tastes = Object.entries(tasteSignature).sort((a, b) => b[1] - a[1]);
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  for (const [taste, proportion] of tastes) {
    const barWidth = proportion * 300;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(120, y - 10, 300, 14);

    ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + proportion * 0.5})`;
    ctx.fillRect(120, y - 10, barWidth, 14);

    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'left';
    ctx.fillText(taste.charAt(0).toUpperCase() + taste.slice(1), 40, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${Math.round(proportion * 100)}%`, W - 40, y);
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';

    y += 22;
  }

  y += 10;

  // Divider
  ctx.strokeStyle = '#1e1e2e';
  ctx.beginPath();
  ctx.moveTo(40, y);
  ctx.lineTo(W - 40, y);
  ctx.stroke();
  y += 20;

  // Cuisine Affinity
  ctx.fillStyle = 'rgba(79, 143, 255, 0.5)';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('CUISINE AFFINITY', 40, y);
  y += 20;

  ctx.font = '12px system-ui, -apple-system, sans-serif';
  for (let i = 0; i < Math.min(cuisineAffinity.length, 5); i++) {
    const c = cuisineAffinity[i];
    const barWidth = c.score * 250;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(160, y - 10, 250, 14);

    ctx.fillStyle = `rgba(34, 197, 94, ${0.3 + c.score * 0.4})`;
    ctx.fillRect(160, y - 10, barWidth, 14);

    const displayName = c.cuisine.replace(/ cuisines?$/i, '');
    ctx.fillStyle = '#ccc';
    ctx.fillText(displayName, 40, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${Math.round(c.score * 100)}%`, W - 40, y);
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, -apple-system, sans-serif';

    y += 22;
  }

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#333';
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.fillText('Generated by Flavor Network', W / 2, H - 25);
}

export default function FlavorPassport({ profile, nodes, onExport }) {
  const canvasRef = useRef(null);

  const weights = useMemo(() => computeProfileWeights(profile, nodes), [profile, nodes]);
  const topIngredients = useMemo(() => getTopIngredients(weights, 10), [weights]);
  const tasteSignature = useMemo(() => getTasteSignature(weights, nodes), [weights, nodes]);
  const cuisineAffinity = useMemo(() => getCuisineAffinity(weights, nodes), [weights, nodes]);

  const stats = useMemo(() => ({
    ingredientCount: (profile?.ingredients || []).length,
    cuisineCount: (profile?.cuisines || []).length,
    recipeCount: (profile?.recipes || []).length,
  }), [profile]);

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawPassport(canvas, { topIngredients, tasteSignature, cuisineAffinity, stats });

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'flavor-passport.png';
      a.click();
      URL.revokeObjectURL(url);
      if (onExport) onExport();
    }, 'image/png');
  }, [topIngredients, tasteSignature, cuisineAffinity, stats, onExport]);

  const hasData = topIngredients.length > 0;

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <button
        onClick={handleExport}
        disabled={!hasData}
        className={`text-[10px] flex items-center gap-1 transition-colors ${
          hasData
            ? 'text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20'
            : 'text-gray-600 cursor-not-allowed bg-white/5'
        } px-2.5 py-1 rounded`}
        title="Download Flavor Passport as PNG"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Passport
      </button>
    </>
  );
}
