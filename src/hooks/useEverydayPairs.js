/**
 * useEverydayPairs — the everyday-pairs index (src/data/everydayPairs.js)
 * for the invent + kitchen panels. null until loaded, and null for good if
 * the file fails to load (callers then use the curated index alone).
 */
import { useEffect, useState } from 'react';
import { loadEverydayPairs } from '../data/everydayPairs.js';

export default function useEverydayPairs() {
  const [everyday, setEveryday] = useState(null);
  useEffect(() => {
    let live = true;
    loadEverydayPairs().then((idx) => { if (live && idx) setEveryday(idx); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return everyday;
}
