import { useState, useRef, useCallback, useEffect } from 'react';

const SNAP_COLLAPSED = 40;
const SNAP_HALF = 50; // percentage of viewport height
const SNAP_FULL = 90;

function getSnapHeight(snapPct) {
  return (snapPct / 100) * window.innerHeight;
}

export default function BottomSheet({ isOpen, onClose, title, children }) {
  const [snapPct, setSnapPct] = useState(SNAP_HALF);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(null);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Reset to half when opened
  useEffect(() => {
    if (isOpen) setSnapPct(SNAP_HALF);
  }, [isOpen]);

  const handleTouchStart = useCallback((e) => {
    setDragging(true);
    startY.current = e.touches[0].clientY;
    startHeight.current = getSnapHeight(snapPct);
  }, [snapPct]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging) return;
    const dy = startY.current - e.touches[0].clientY;
    const newHeight = Math.max(SNAP_COLLAPSED, Math.min(startHeight.current + dy, getSnapHeight(SNAP_FULL)));
    setDragY(newHeight);
  }, [dragging]);

  const handleTouchEnd = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dragY == null) return;

    const vh = window.innerHeight;
    const pct = (dragY / vh) * 100;

    // Snap to closest
    if (pct < 15) {
      onClose();
    } else if (pct < 35) {
      setSnapPct(SNAP_COLLAPSED);
    } else if (pct < 70) {
      setSnapPct(SNAP_HALF);
    } else {
      setSnapPct(SNAP_FULL);
    }
    setDragY(null);
  }, [dragging, dragY, onClose]);

  // Also support mouse for testing in browser
  const handleMouseDown = useCallback((e) => {
    setDragging(true);
    startY.current = e.clientY;
    startHeight.current = getSnapHeight(snapPct);

    const onMouseMove = (ev) => {
      const dy = startY.current - ev.clientY;
      const newHeight = Math.max(SNAP_COLLAPSED, Math.min(startHeight.current + dy, getSnapHeight(SNAP_FULL)));
      setDragY(newHeight);
    };
    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [snapPct]);

  // Compute transform
  useEffect(() => {
    if (!dragging && dragY != null) {
      const vh = window.innerHeight;
      const pct = (dragY / vh) * 100;
      if (pct < 15) {
        onClose();
      } else if (pct < 35) {
        setSnapPct(SNAP_COLLAPSED);
      } else if (pct < 70) {
        setSnapPct(SNAP_HALF);
      } else {
        setSnapPct(SNAP_FULL);
      }
      setDragY(null);
    }
  }, [dragging, dragY, onClose]);

  if (!isOpen) return null;

  const height = dragging && dragY != null ? dragY : getSnapHeight(snapPct);
  const isCollapsed = !dragging && snapPct === SNAP_COLLAPSED;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[65] sm:hidden"
      style={{
        height: `${height}px`,
        transition: dragging ? 'none' : 'height 0.3s ease-out',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="h-full bg-[#12121a]/95 backdrop-blur-md border-t border-[#2a2a3a] rounded-t-2xl flex flex-col overflow-hidden">
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 flex-shrink-0">
          <h2 className="text-sm font-medium text-gray-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto px-4 pb-4 ${isCollapsed ? 'hidden' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
