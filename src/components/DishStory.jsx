/**
 * DishStory — STORIES-1. "About this dish / sauce / drink / wine" section for
 * the Cookbook, Sauce, Cocktail and Wine cards: a Commons photo in a thin
 * chalk frame, a 1–2 sentence background from Wikipedia, and the credit
 * line. Renders whatever exists (story without photo is fine) and nothing at
 * all when there is no story.
 *
 * The photo box has its aspect ratio fixed from the stored thumbnail size
 * before the image arrives, so the card never jumps while it loads. Photos
 * are hotlinked from upload.wikimedia.org — offline, the box stays an empty
 * frame and the text still reads.
 */
import { useEffect, useState } from 'react';
import { loadDishStories, storyFor } from '../data/dishStories.js';
import { FONT, CHALK_CREAM, CHALK_DIM, CHALK_SUB, CHALK_RAIL, CHALK_SHADOW } from '../data/chalkTheme.js';

const NOUN = { recipe: 'dish', sauce: 'sauce', cocktail: 'drink', wine: 'wine' };
const BOX_H = 200; // px — tallest the photo box gets

// Keep extreme panoramas / tall glasses inside sensible bounds; the image is
// cropped (object-fit: cover) to the box, never stretched.
function boxAspect(photo) {
  const ar = photo?.w && photo?.h ? photo.w / photo.h : 4 / 3;
  return Math.min(16 / 9, Math.max(3 / 4, ar));
}

function useStory(kind, storyKey, given) {
  const [story, setStory] = useState(() => (given !== undefined ? given : storyFor(kind, storyKey)));
  useEffect(() => {
    if (given !== undefined) { setStory(given); return undefined; }
    let alive = true;
    setStory(storyFor(kind, storyKey));
    loadDishStories().then((d) => { if (alive) setStory(storyFor(kind, storyKey, d)); });
    return () => { alive = false; };
  }, [kind, storyKey, given]);
  return story;
}

const linkStyle = { color: CHALK_DIM, textDecoration: 'underline', textUnderlineOffset: 2 };
const LINK = 'rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60';

export default function DishStory({ kind = 'recipe', storyKey, name, story: given, className = '' }) {
  const story = useStory(kind, storyKey, given);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [story]);
  if (!story || !story.text) return null;

  const noun = NOUN[kind] || 'dish';
  const photo = story.photo && story.photo.src && !imgFailed ? story.photo : null;
  const ar = boxAspect(photo);
  const label = name || story.title;

  return (
    <section className={`mt-3 ${className}`} data-testid="dish-story" aria-label={`About this ${noun}`}>
      <div className="uppercase tracking-[0.16em] mb-1.5"
        style={{ fontFamily: FONT, fontSize: '15px', color: CHALK_DIM, textShadow: CHALK_SHADOW }}>
        About this {noun}
      </div>

      {photo && (
        <figure className="m-0 mb-2 mx-auto" data-testid="dish-story-photo" data-aspect={ar.toFixed(3)}
          style={{
            width: `min(100%, ${Math.round(BOX_H * ar)}px)`,
            aspectRatio: `${ar}`,
            padding: 3,
            border: `1.5px solid ${CHALK_CREAM}60`,
            borderRadius: 6,
            boxShadow: CHALK_SHADOW,
            background: `${CHALK_RAIL}40`,
            transform: 'rotate(-0.6deg)',
          }}>
          <img
            src={photo.src}
            width={photo.w || 400}
            height={photo.h || 300}
            loading="lazy"
            decoding="async"
            alt={`Photo of ${String(label).toLowerCase()}`}
            onError={() => setImgFailed(true)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }}
          />
        </figure>
      )}

      <p className="leading-snug" data-testid="dish-story-text"
        style={{ fontSize: '15px', color: CHALK_CREAM, margin: 0 }}>
        {story.text}
      </p>

      <p className="mt-1.5" data-testid="dish-story-credit" style={{ fontSize: '11.5px', lineHeight: 1.35, color: CHALK_SUB, margin: '6px 0 0' }}>
        Text: <a href={story.url} target="_blank" rel="noopener noreferrer" className={LINK} style={linkStyle}>Wikipedia</a>
        {' ('}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer license" className={LINK} style={linkStyle}>CC BY-SA</a>{')'}
        {photo && (
          <>
            {' · Photo: '}
            <a href={photo.page} target="_blank" rel="noopener noreferrer" className={LINK} style={linkStyle}>{photo.artist}</a>
            {', '}
            {photo.licenseUrl
              ? <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer license" className={LINK} style={linkStyle}>{photo.license}</a>
              : <span>{photo.license}</span>}
          </>
        )}
      </p>
    </section>
  );
}
