import { useState, useEffect, useRef } from 'react';

/**
 * Floating heart button that appears near a hovered node in the 3D scene.
 * Click to quick-add/remove an ingredient from the user's flavor profile.
 *
 * Props:
 *   - node: hovered node object (or null)
 *   - mousePos: { x, y } client coordinates
 *   - isFavorite: boolean — whether the ingredient is in the profile
 *   - onToggle: (ingredientName) => void
 */
export default function NodeFavoriteButton({ node, mousePos, isFavorite, onToggle }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const hideTimer = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (node && mousePos) {
      clearTimeout(hideTimer.current);
      setPos({ x: mousePos.x + 16, y: mousePos.y - 16 });
      setVisible(true);
    } else {
      // Delay hiding so user can move cursor to the button
      hideTimer.current = setTimeout(() => setVisible(false), 300);
    }
    return () => clearTimeout(hideTimer.current);
  }, [node, mousePos]);

  // Keep visible while mouse is over the button itself
  const handleMouseEnter = () => {
    clearTimeout(hideTimer.current);
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 200);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (node && onToggle) {
      onToggle(node.name);
    }
  };

  if (!visible || !node) return null;

  return (
    <button
      ref={btnRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="fixed z-50 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 border"
      style={{
        left: pos.x,
        top: pos.y,
        background: isFavorite
          ? 'rgba(255, 80, 120, 0.9)'
          : 'rgba(20, 20, 35, 0.85)',
        borderColor: isFavorite
          ? 'rgba(255, 120, 160, 0.8)'
          : 'rgba(79, 143, 255, 0.4)',
        boxShadow: isFavorite
          ? '0 0 12px rgba(255, 80, 120, 0.5)'
          : '0 0 8px rgba(79, 143, 255, 0.3)',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
      }}
      title={isFavorite ? `Remove ${node.name} from profile` : `Add ${node.name} to profile`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={isFavorite ? '#fff' : 'none'}
        stroke={isFavorite ? '#fff' : 'rgba(79, 143, 255, 0.9)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
