import { useRef, useEffect, useCallback, useState } from 'react';
import { TASTE_COLORS } from '../utils/color.js';
import { TASTE_KEYS } from '../data/recipeLayout.js';

const PAPER_COLOR = '#fefae0';
const LINE_COLOR = '#c9b99a';
const MARGIN_COLOR = '#e07070';
const PENCIL_COLOR = '#3a3428';
const LINE_SPACING = 28;
const NODE_RADIUS = 18;
const CENTER_RADIUS = 26;

function desaturate(hex, amount = 0.35) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `rgb(${nr},${ng},${nb})`;
}

// Wobbly line for hand-drawn effect
function wobblyLine(ctx, x1, y1, x2, y2, segments = 8) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const mx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 2;
    const my = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 2;
    ctx.lineTo(mx, my);
  }
  ctx.stroke();
}

export default function NotebookCanvas({
  centerIngredient,
  layoutPositions,
  recipeIngredients,
  hoveredNode,
  onHoverNode,
  onClickNode,
  width,
  height,
}) {
  const canvasRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });
  const hitTargets = useRef([]);

  // Convert screen coords to world coords
  const screenToWorld = useCallback((sx, sy) => {
    const cx = width / 2;
    const cy = height / 2;
    return {
      x: (sx - cx) / camera.zoom - camera.x,
      y: (sy - cy) / camera.zoom - camera.y,
    };
  }, [width, height, camera]);

  // Hit test
  const hitTest = useCallback((sx, sy) => {
    const world = screenToWorld(sx, sy);
    for (const target of hitTargets.current) {
      const dx = world.x - target.x;
      const dy = world.y - target.y;
      if (dx * dx + dy * dy <= target.radius * target.radius) {
        return target.name;
      }
    }
    return null;
  }, [screenToWorld]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = width / 2;
    const cy = height / 2;

    // Clear & draw paper background
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Ruled lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 0.5;
    for (let y = LINE_SPACING; y < height; y += LINE_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Red margin line
    ctx.strokeStyle = MARGIN_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(60, height);
    ctx.stroke();

    // Apply camera transform
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(camera.x, camera.y);

    const targets = [];

    // Draw taste axis lines (faint)
    if (centerIngredient) {
      const axisLen = 400;
      for (const taste of TASTE_KEYS) {
        const angle = Math.PI * 2 * TASTE_KEYS.indexOf(taste) / 8;
        const ex = Math.cos(angle) * axisLen;
        const ey = Math.sin(angle) * axisLen;

        ctx.strokeStyle = 'rgba(180,160,130,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);

        // Axis label
        ctx.font = '14px Caveat, cursive';
        ctx.fillStyle = 'rgba(140,120,100,0.5)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(taste, ex * 1.12, ey * 1.12);
      }
    }

    // Draw connection lines from center to pairings
    if (centerIngredient && layoutPositions) {
      for (const [name, pos] of layoutPositions) {
        const opacity = 0.15 + pos.strength * 0.5;
        const color = TASTE_COLORS[pos.dominantTaste] || TASTE_COLORS.default;
        ctx.strokeStyle = desaturate(color, 0.5);
        ctx.globalAlpha = opacity;
        ctx.lineWidth = 1 + pos.strength * 1.5;
        wobblyLine(ctx, 0, 0, pos.x, pos.y, 6);
        ctx.globalAlpha = 1;
      }
    }

    // Draw pairing nodes
    if (layoutPositions) {
      for (const [name, pos] of layoutPositions) {
        const isInRecipe = recipeIngredients.includes(name);
        const isHovered = hoveredNode === name;
        const color = TASTE_COLORS[pos.dominantTaste] || TASTE_COLORS.default;
        const nodeColor = desaturate(color, 0.3);
        const r = NODE_RADIUS + (isHovered ? 4 : 0);

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isInRecipe ? nodeColor : desaturate(color, 0.55);
        ctx.globalAlpha = isInRecipe ? 0.9 : 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Border
        ctx.strokeStyle = isInRecipe ? PENCIL_COLOR : 'rgba(100,90,70,0.4)';
        ctx.lineWidth = isInRecipe ? 2 : 1;
        ctx.stroke();

        // Label
        ctx.font = `${isHovered ? 'bold ' : ''}16px Caveat, cursive`;
        ctx.fillStyle = PENCIL_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(name, pos.x, pos.y + r + 4);

        targets.push({ name, x: pos.x, y: pos.y, radius: r + 6 });
      }
    }

    // Draw center ingredient
    if (centerIngredient) {
      ctx.beginPath();
      ctx.arc(0, 0, CENTER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#f5e6c8';
      ctx.fill();
      ctx.strokeStyle = PENCIL_COLOR;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = 'bold 20px Caveat, cursive';
      ctx.fillStyle = PENCIL_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(centerIngredient, 0, 0);

      targets.push({ name: centerIngredient, x: 0, y: 0, radius: CENTER_RADIUS + 6 });
    }

    // Tooltip for hovered node
    if (hoveredNode && layoutPositions && layoutPositions.has(hoveredNode)) {
      const pos = layoutPositions.get(hoveredNode);
      const str = Math.round(pos.strength * 100);
      ctx.font = 'bold 14px Caveat, cursive';
      ctx.fillStyle = 'rgba(58,52,40,0.85)';
      const txt = `${str}% match`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(254,250,224,0.92)';
      ctx.fillRect(pos.x - tw / 2 - 6, pos.y - NODE_RADIUS - 26, tw + 12, 22);
      ctx.strokeStyle = 'rgba(100,90,70,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pos.x - tw / 2 - 6, pos.y - NODE_RADIUS - 26, tw + 12, 22);
      ctx.fillStyle = PENCIL_COLOR;
      ctx.font = 'bold 14px Caveat, cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, pos.x, pos.y - NODE_RADIUS - 15);
    }

    ctx.restore();
    hitTargets.current = targets;
  }, [centerIngredient, layoutPositions, recipeIngredients, hoveredNode, width, height, camera]);

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    dragRef.current = { dragging: true, startX: sx, startY: sy, camStartX: camera.x, camStartY: camera.y };
  }, [camera]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current.dragging) {
      const dx = (sx - dragRef.current.startX) / camera.zoom;
      const dy = (sy - dragRef.current.startY) / camera.zoom;
      setCamera(c => ({ ...c, x: dragRef.current.camStartX + dx, y: dragRef.current.camStartY + dy }));
      return;
    }

    const hit = hitTest(sx, sy);
    onHoverNode(hit);
    canvasRef.current.style.cursor = hit ? 'pointer' : 'grab';
  }, [camera.zoom, hitTest, onHoverNode]);

  const handleMouseUp = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const d = dragRef.current;
    const moved = Math.abs(sx - d.startX) + Math.abs(sy - d.startY);
    dragRef.current.dragging = false;

    if (moved < 5) {
      const hit = hitTest(sx, sy);
      if (hit) onClickNode(hit);
    }
  }, [hitTest, onClickNode]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setCamera(c => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.3, Math.min(3, c.zoom * factor));
      return { ...c, zoom: newZoom };
    });
  }, []);

  // Touch support
  const touchRef = useRef({ lastDist: 0 });

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY, camStartX: camera.x, camStartY: camera.y };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchRef.current.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, [camera]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragRef.current.dragging) {
      const t = e.touches[0];
      const dx = (t.clientX - dragRef.current.startX) / camera.zoom;
      const dy = (t.clientY - dragRef.current.startY) / camera.zoom;
      setCamera(c => ({ ...c, x: dragRef.current.camStartX + dx, y: dragRef.current.camStartY + dy }));
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (touchRef.current.lastDist > 0) {
        const scale = dist / touchRef.current.lastDist;
        setCamera(c => ({ ...c, zoom: Math.max(0.3, Math.min(3, c.zoom * scale)) }));
      }
      touchRef.current.lastDist = dist;
    }
  }, [camera.zoom]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      const d = dragRef.current;
      if (d.dragging && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        const moved = Math.abs(t.clientX - d.startX) + Math.abs(t.clientY - d.startY);
        if (moved < 10) {
          const rect = canvasRef.current.getBoundingClientRect();
          const hit = hitTest(t.clientX - rect.left, t.clientY - rect.top);
          if (hit) onClickNode(hit);
        }
      }
      dragRef.current.dragging = false;
      touchRef.current.lastDist = 0;
    }
  }, [hitTest, onClickNode]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block', touchAction: 'none', cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { dragRef.current.dragging = false; onHoverNode(null); }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}
