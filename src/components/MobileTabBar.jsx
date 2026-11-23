import { useEffect, useState } from 'react';
import { Home, Person, Labs, Help, chalkUnderline, chalkRule } from './ChalkIcons.jsx';
import { SANS, ACCENT } from './inventUi.jsx';
import { CHALK_BG, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL } from '../data/chalkTheme.js';

// Labs popover destinations. The Flavor Network (the 3D pairing map) is
// surfaced here again (2026-06-25) now that the Pairing Lab gives it a
// clear purpose + an on-ramp; the "Molecule Lab" compound inspector
// remains retired.
const LABS = [
  { id: 'make',     label: 'Recipe Lab',       desc: 'Cook from your kitchen, or invent' },
  { id: 'cookbook', label: 'Cookbook',         desc: 'Browse saved recipes' },
  { id: 'cocktail', label: 'Cocktail Lab',     desc: 'Mix a drink' },
  { id: 'sauce',    label: 'Sauce Lab',        desc: 'Build a sauce' },
  { id: 'wine',     label: 'Wine Lab',         desc: 'Pair a wine' },
  { id: 'pairing',  label: 'Pairing Lab',      desc: 'Explore flavor pairings' },
  { id: 'shopping', label: 'Shopping list',    desc: 'Tick things off as you shop' },
  { id: 'recipe',   label: 'Recipe Notebook',  desc: 'Build a recipe on the chalkboard' },
  { id: 'profile',  label: 'Profile',          desc: 'Saved recipes & insights' },
];

const LABS_SCREENS = ['make', 'cookbook', 'cocktail', 'sauce', 'wine', 'pairing', 'labs', 'shopping', 'recipe', 'profile'];

/**
 * MobileTabBar — bottom-of-viewport nav: Home · (Sign in) · Labs · How-to.
 *
 * Drawn chalk icons (ChalkIcons), opaque slate, an uneven chalk rule on top. Muted chalk at rest;
 * the Accent marks ONLY the current tab, which is also shown by a drawn underline, a heavier label
 * and aria-current. Exactly one tab (or none) is current: Sign in while a signed-out visitor is on
 * the profile page, otherwise Labs on any lab screen. How-to opens a sheet and is never current.
 */
export default function MobileTabBar({
  activeTab,
  onTabChange,
  onSelectLab,
  onOpenHowItWorks,
  onHome,
  user = null,
  howItWorksOpen = false,
}) {
  const [labsOpen, setLabsOpen] = useState(false);
  const [hover, setHover] = useState(null);

  const signInCurrent = !user && activeTab === 'profile';
  const labsCurrent = LABS_SCREENS.includes(activeTab) && !signInCurrent;

  const closeAll = () => setLabsOpen(false);

  useEffect(() => {
    if (!labsOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [labsOpen]);

  const tabStyle = (id, current) => ({
    fontFamily: SANS,
    color: current ? ACCENT : hover === id ? CHALK_CREAM : CHALK_DIM,
    background: 'transparent',
  });
  const labelStyle = (current) => ({ fontSize: 13, lineHeight: '16px', fontWeight: current ? 600 : 400 });
  const tabClass = 'flex flex-col items-center justify-center min-w-[64px] h-14 px-2';
  const mark = (current) => (
    <span className="block" style={{ height: 6, marginTop: 1, visibility: current ? 'visible' : 'hidden' }}>
      {current ? chalkUnderline() : null}
    </span>
  );
  const hoverProps = (id) => ({ onMouseEnter: () => setHover(id), onMouseLeave: () => setHover(null) });

  return (
    <>
      {labsOpen && (
        <div className="fixed inset-0 z-[99]" onClick={closeAll} />
      )}

      <div
        data-testid="mobile-tab-bar"
        className="fixed bottom-0 inset-x-0 z-[100]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', background: CHALK_BG }}
      >
        <div style={{ color: CHALK_RAIL, lineHeight: 0, position: 'absolute', top: 0, left: 0, right: 0 }}>{chalkRule()}</div>
        <div className="flex items-center justify-evenly h-14 mx-auto" style={{ maxWidth: 480 }}>
          <button
            onClick={() => { if (onHome) onHome(); closeAll(); }}
            data-testid="tabbar-home"
            className={tabClass}
            style={tabStyle('home', false)}
            {...hoverProps('home')}
            aria-label="Home"
          >
            <Home size={24} />
            <span style={labelStyle(false)}>Home</span>
            {mark(false)}
          </button>

          {/* WEBLINK-11: top-level Sign in, signed-out only; gone once signed in so the bar stays three-wide. */}
          {!user && (
            <button
              onClick={() => { onTabChange('profile'); closeAll(); }}
              data-testid="tabbar-signin"
              className={tabClass}
              style={tabStyle('signin', signInCurrent)}
              {...hoverProps('signin')}
              aria-current={signInCurrent ? 'page' : undefined}
              aria-label="Sign in"
            >
              <Person size={24} />
              <span style={labelStyle(signInCurrent)}>Sign in</span>
              {mark(signInCurrent)}
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setLabsOpen((v) => !v)}
              data-testid="tabbar-labs"
              aria-expanded={labsOpen ? 'true' : 'false'}
              aria-current={labsCurrent ? 'page' : undefined}
              className={tabClass}
              style={tabStyle('labs', labsCurrent)}
              {...hoverProps('labs')}
              aria-label="Labs"
            >
              <Labs size={24} />
              <span style={labelStyle(labsCurrent)}>Labs</span>
              {mark(labsCurrent)}
            </button>
            {labsOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 w-56 z-[101] overflow-hidden"
                style={{ background: CHALK_BG, border: `1px solid ${CHALK_RAIL}` }}
                data-testid="tabbar-labs-menu"
              >
                {LABS.map((lab) => {
                  // WEBLINK-11: "Profile / Saved recipes & insights" gave a signed-out user no reason to think sign-in lived there.
                  const isSignIn = lab.id === 'profile' && !user;
                  const label = isSignIn ? 'Sign in' : lab.label;
                  const desc = isSignIn ? 'Save recipes, import from links' : lab.desc;
                  const current = activeTab === lab.id;
                  return (
                    <button
                      key={lab.id}
                      onClick={() => {
                        closeAll();
                        if (onSelectLab) onSelectLab(lab.id);
                        else onTabChange(lab.id);
                      }}
                      data-testid={`tabbar-labs-item-${lab.id}`}
                      aria-current={current ? 'page' : undefined}
                      className="w-full text-left px-3 py-2 min-h-[44px] hover:bg-white/5 flex flex-col"
                      style={{ fontFamily: SANS }}
                    >
                      <span style={{ fontSize: 16, lineHeight: '20px', color: CHALK_CREAM, display: 'inline-flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
                        {label}
                        {current ? chalkUnderline({ width: 22 }) : null}
                      </span>
                      <span style={{ fontSize: 13, lineHeight: '16px', color: CHALK_SUB }}>{desc}</span>
                    </button>
                  );
                })}
                {onOpenHowItWorks && (
                  <>
                    <div style={{ color: CHALK_RAIL, lineHeight: 0 }}>{chalkRule()}</div>
                    <button
                      onClick={() => { closeAll(); onOpenHowItWorks(); }}
                      data-testid="tabbar-labs-item-how-it-works"
                      className="w-full text-left px-3 py-2 min-h-[44px] hover:bg-white/5 flex items-center gap-1"
                      style={{ fontFamily: SANS, color: CHALK_CREAM }}
                    >
                      <Help size={20} />
                      <span style={{ fontSize: 16, lineHeight: '20px' }}>How it works</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {onOpenHowItWorks && (
            <button
              onClick={() => { onOpenHowItWorks(); closeAll(); }}
              data-testid="tabbar-howto"
              className={tabClass}
              style={tabStyle('howto', false)}
              {...hoverProps('howto')}
              aria-expanded={howItWorksOpen ? 'true' : 'false'}
              aria-label="How it works"
            >
              <Help size={24} />
              <span style={labelStyle(false)}>How-to</span>
              {mark(false)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
