import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import Fuse from 'fuse.js';

const MOBILE_HINTS = [
  'Search ingredients...',
  "Try 'garlic' or 'chocolate'...",
  'Discover unexpected pairings...',
  'Search 4,488 ingredients...',
];

function SearchBar({ ingredients, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [hintIndex, setHintIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const isMobileRef = useRef(window.matchMedia('(max-width: 640px)').matches);
  const [inputFocused, setInputFocused] = useState(false);

  // Rotate placeholder hints on mobile (pause while input is focused)
  useEffect(() => {
    if (!isMobileRef.current || inputFocused) return;
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % MOBILE_HINTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [inputFocused]);

  const fuse = useMemo(() => {
    const docs = (ingredients || []).map((n) => ({ name: n }));
    return new Fuse(docs, { keys: ['name'], threshold: 0.4 });
  }, [ingredients]);

  const handleQueryChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);

      if (value.trim().length === 0) {
        setResults([]);
        setIsOpen(false);
        setHighlightIndex(-1);
        return;
      }

      const matched = fuse.search(value, { limit: 8 });
      setResults(matched.map((r) => r.item));
      setIsOpen(matched.length > 0);
      setHighlightIndex(-1);
    },
    [fuse],
  );

  const selectItem = useCallback(
    (name) => {
      onSelect(name);
      setQuery('');
      setResults([]);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e) => {
      // Enter must work the instant results exist, even if the dropdown's
      // `isOpen` flag hasn't flushed yet (state batching) — otherwise
      // typing fast and hitting Enter no-ops. Only guard on the actual
      // result list.
      if (results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        return;
      }
      // Make sure the dropdown is open the moment the user starts
      // arrow-navigating or committing — covers the case where blur
      // suppressed it but results are still valid.
      if (!isOpen && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        setIsOpen(true);
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setHighlightIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        }
        case 'Enter': {
          e.preventDefault();
          // Arrow-pick wins. Otherwise prefer an exact case-insensitive
          // name match over the fuzzy top result so typing the full name
          // never lands on a near-miss that ranked higher in fuse.
          if (highlightIndex >= 0 && highlightIndex < results.length) {
            selectItem(results[highlightIndex].name);
          } else {
            const q = query.trim().toLowerCase();
            const exact = results.find((r) => r.name.toLowerCase() === q);
            selectItem((exact || results[0]).name);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setIsOpen(false);
          setHighlightIndex(-1);
          break;
        }
        default:
          break;
      }
    },
    [isOpen, results, highlightIndex, selectItem, query],
  );

  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightIndex];
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.closest('.search-container')?.contains(e.target)) {
        setIsOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="search-container fixed left-1/2 -translate-x-1/2 z-[55] w-[calc(100%-5rem)] sm:w-72 md:w-88" style={{ top: 'var(--nav-h)' }}>
      <input
        ref={inputRef}
        id="ingredient-search-input"
        type="search"
        value={query}
        onChange={handleQueryChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setInputFocused(true);
          if (results.length > 0) setIsOpen(true);
        }}
        onBlur={() => setInputFocused(false)}
        placeholder={isMobileRef.current ? MOBILE_HINTS[hintIndex] : 'Search ingredients...'}
        aria-label="Search ingredients"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-activedescendant={
          highlightIndex >= 0 ? `search-result-${highlightIndex}` : undefined
        }
        role="combobox"
        className={
          'w-full px-4 py-3 rounded-lg bg-[#0a0a0f] border border-gray-700 ' +
          'text-gray-100 placeholder-gray-500 outline-none transition-all ' +
          'focus:border-[#4f8fff] focus:shadow-[0_0_20px_rgba(79,143,255,0.3)]'
        }
      />

      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className={
            'mt-2 rounded-lg bg-gray-900 border border-gray-700 ' +
            'max-h-64 overflow-y-auto shadow-lg'
          }
        >
          {results.map((item, index) => (
            <li
              key={item.name}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item.name);
              }}
              onMouseEnter={() => setHighlightIndex(index)}
              className={
                'px-4 py-2 cursor-pointer text-gray-100 transition-colors ' +
                (index === highlightIndex
                  ? 'bg-[#4f8fff]/20 text-white'
                  : 'hover:bg-[#4f8fff]/10')
              }
            >
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default memo(SearchBar);
