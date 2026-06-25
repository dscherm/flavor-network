import { useState } from 'react';

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left py-1 hover:bg-[#f0e8d0] rounded transition-colors"
      >
        <span className="text-[13px]" style={{ color: '#8a7a5a' }}>{open ? '\u25BE' : '\u25B8'}</span>
        <span className="text-sm font-bold" style={{ color: '#5a4a2a' }}>{icon} {title}</span>
      </button>
      {open && <div className="pl-3 pb-1">{children}</div>}
    </div>
  );
}

function StrengthBadge({ value }) {
  const pct = Math.round(value * 100);
  const color = pct > 60 ? '#4a8a4a' : pct > 30 ? '#8a7a3a' : '#8a4a4a';
  return (
    <span
      className="inline-block text-xs px-1.5 py-0.5 rounded-md font-bold"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {pct}%
    </span>
  );
}

export default function RecipeAnalysis({ analysis }) {
  if (!analysis) return null;

  const { interesting, unusual, suggestions, structureAdvice } = analysis;
  const hasContent = interesting.length > 0 || unusual.length > 0 ||
    suggestions.add.length > 0 || suggestions.swap.length > 0 || structureAdvice;

  if (!hasContent) {
    return (
      <p className="text-sm italic py-2" style={{ color: '#9a8a6a' }}>
        Add more ingredients to see analysis...
      </p>
    );
  }

  return (
    <div>
      {interesting.length > 0 && (
        <Section title="What's Interesting" icon="\u2728" defaultOpen>
          {interesting.map(({ pair, strength, reason }) => (
            <div key={pair.join('-')} className="flex items-center gap-1.5 py-0.5">
              <StrengthBadge value={strength} />
              <span className="text-sm" style={{ color: '#3a3428' }}>
                {pair[0]} + {pair[1]}
              </span>
              <span className="text-[13px] ml-auto" style={{ color: '#9a8a6a' }}>{reason}</span>
            </div>
          ))}
        </Section>
      )}

      {unusual.length > 0 && (
        <Section title="Watch Out" icon="\u26A0">
          {unusual.map(({ ingredient, note }) => (
            <div key={ingredient} className="py-0.5">
              <span className="text-sm font-bold" style={{ color: '#8a4a4a' }}>{ingredient}</span>
              <p className="text-[13px]" style={{ color: '#8a7a5a' }}>{note}</p>
            </div>
          ))}
        </Section>
      )}

      {suggestions.add.length > 0 && (
        <Section title="Try Adding" icon="+">
          {suggestions.add.map(({ name, avgStrength, reason }) => (
            <div key={name} className="flex items-center gap-1.5 py-0.5">
              <StrengthBadge value={avgStrength} />
              <span className="text-sm" style={{ color: '#3a3428' }}>{name}</span>
              <span className="text-[13px] ml-auto" style={{ color: '#9a8a6a' }}>{reason}</span>
            </div>
          ))}
        </Section>
      )}

      {suggestions.swap.length > 0 && (
        <Section title="Consider Swapping" icon="\u21C4">
          {suggestions.swap.map(({ remove, addInstead, improvement, reason }) => (
            <div key={`${remove}-${addInstead}`} className="py-0.5">
              <div className="flex items-center gap-1 text-sm">
                <span style={{ color: '#8a4a4a' }}>{remove}</span>
                <span style={{ color: '#9a8a6a' }}>{'\u2192'}</span>
                <span style={{ color: '#4a8a4a' }}>{addInstead}</span>
                <span className="ml-auto text-[13px] font-bold" style={{ color: '#4a8a4a' }}>+{improvement}%</span>
              </div>
              <p className="text-[13px]" style={{ color: '#8a7a5a' }}>{reason}</p>
            </div>
          ))}
        </Section>
      )}

      {structureAdvice && (
        <Section title="Structure Advice" icon="\uD83C\uDFAF">
          {structureAdvice.selectedMatch && (
            <div className="py-0.5">
              <span className="text-sm" style={{ color: '#3a3428' }}>
                {structureAdvice.selectedMatch.name}: {structureAdvice.selectedMatch.confidence}%
              </span>
              {structureAdvice.selectedMatch.missing.length > 0 && (
                <p className="text-[13px]" style={{ color: '#8a7a5a' }}>
                  Missing: {structureAdvice.selectedMatch.missing.join(', ')}
                </p>
              )}
            </div>
          )}
          <p className="text-sm italic" style={{ color: '#5a4a2a' }}>
            {structureAdvice.advice}
          </p>
        </Section>
      )}
    </div>
  );
}
