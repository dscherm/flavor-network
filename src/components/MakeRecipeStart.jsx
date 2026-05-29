import React, { useEffect, useRef } from 'react';

const CARDS = [
  {
    id: 'existing',
    icon: '📖',
    title: 'Existing recipe',
    subtitle: 'Pick from your Cookbook',
    accent: '#a78bfa',
  },
  {
    id: 'scratch',
    icon: '✏️',
    title: 'Start from scratch',
    subtitle: 'Empty Recipe Lab',
    accent: '#38bdf8',
  },
  {
    id: 'photo',
    icon: '📷',
    title: 'Upload a photo',
    subtitle: "We'll add the image; you fill in ingredients (parsing coming later)",
    accent: '#f472b6',
  },
];

export default function MakeRecipeStart({
  setRecipeHandoff,
  setRecipeMounted,
  setActiveTab,
  setCookbookPickerMode,
}) {
  const fileInputRef = useRef(null);
  const firstCardRef = useRef(null);

  useEffect(() => {
    firstCardRef.current?.focus();
  }, []);

  const handleExisting = () => {
    setCookbookPickerMode?.('make');
    setActiveTab('cookbook');
  };

  const handleScratch = () => {
    setRecipeHandoff({
      source: 'make-scratch',
      ingredients: [],
      image: null,
      recipeType: null,
      mode: null,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const handlePhotoCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    setRecipeHandoff({
      source: 'make-photo',
      ingredients: [],
      image: file,
      recipeType: null,
      mode: null,
      ts: Date.now(),
    });
    setRecipeMounted(true);
    setActiveTab('recipe');
  };

  const onCardClick = (id) => {
    if (id === 'existing') return handleExisting();
    if (id === 'scratch') return handleScratch();
    if (id === 'photo') return handlePhotoCardClick();
  };

  const refForCard = (id) => (id === 'existing' ? firstCardRef : null);

  return (
    <div
      role="region"
      aria-label="Make a recipe"
      data-testid="make-recipe-start"
      className="flex flex-col items-center justify-center px-4"
      style={{ minHeight: 'calc(100vh - var(--nav-h))' }}
    >
      <div className="w-full max-w-md flex flex-col gap-4">
        {CARDS.map((c) => (
          <button
            key={c.id}
            ref={refForCard(c.id)}
            type="button"
            data-testid={`make-card-${c.id}`}
            aria-label={`${c.title}. ${c.subtitle}`}
            onClick={() => onCardClick(c.id)}
            className="relative w-full rounded-xl border border-[#1e1e2e] bg-[#12203b] p-5 sm:p-6 text-left transition-colors hover:bg-[#16284a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            style={{ minHeight: 44 }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
              style={{ backgroundColor: c.accent }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 pl-2">
              <div
                className="flex items-center justify-center w-20 h-20 rounded-lg bg-[#0a1428]/60 text-4xl"
                aria-hidden="true"
              >
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg font-semibold text-cyan-100">
                  {c.title}
                </div>
                <div className="text-sm text-cyan-300/80 mt-1">{c.subtitle}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="make-photo-input"
      />
    </div>
  );
}
