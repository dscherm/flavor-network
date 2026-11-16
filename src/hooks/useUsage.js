import { useCallback, useEffect, useRef } from 'react';
import { usage } from '../data/usageEvents.js';

/**
 * Usage events that need a little state to fire once, not on every render or keystroke.
 * All of them go through usageEvents.js and never throw.
 */

/**
 * invent_started / invent_style_chosen / invent_named for one invent panel.
 *   const invent = useInventUsage('cocktail', { started, categoryId, editing: !!editItem });
 *   <InventNameSave onNameCommit={invent.named} …/>
 * started: true once the panel holds an ingredient; false again after Start over (a new run).
 * Editing a saved item is not a start. The first value of categoryId is the starting point, not a choice.
 */
export function useInventUsage(lab, { started, categoryId, editing = false }) {
  const startedRef = useRef(false);
  const namedRef = useRef(false);
  const styleRef = useRef(categoryId ?? null);

  useEffect(() => {
    if (!started) { startedRef.current = false; namedRef.current = false; return; }
    if (!startedRef.current) {
      startedRef.current = true;
      if (!editing) usage.inventStarted(lab);
    }
  }, [started, editing, lab]);

  useEffect(() => {
    const now = categoryId ?? null;
    if (now !== styleRef.current && now !== null) usage.inventStyleChosen(lab);
    styleRef.current = now;
  }, [categoryId, lab]);

  const named = useCallback((text) => {
    if (namedRef.current || !String(text || '').trim()) return;
    namedRef.current = true;
    usage.inventNamed(lab);
  }, [lab]);

  return { named };
}

/**
 * search_no_result, once per settled query: the search box must hold the same text that matches
 * nothing for `delay` ms. Clearing the box allows the same query to count again later.
 */
export function useNoResultSearch(lab, term, noResult, delay = 1200) {
  const last = useRef('');
  const text = String(term || '').trim();
  useEffect(() => {
    if (!text) { last.current = ''; return undefined; }
    if (!noResult || last.current === text.toLowerCase()) return undefined;
    const id = setTimeout(() => {
      last.current = text.toLowerCase();
      usage.searchNoResult(lab, text);
    }, delay);
    return () => clearTimeout(id);
  }, [lab, text, noResult, delay]);
}
