// STORIES-1 — matching rules for Wikipedia dish stories, on fixtures (no network).
import { describe, it, expect } from 'vitest';
import {
  fold, tokens, sentenceCase, similarity, tidyText, cleanName, candidateTitles, isFoodPage, namePlausible, acceptSummary,
  splitSentences, firstSentences, commonsFileFromUrl, isFreeLicense, stripHtml, cleanArtist,
} from '../dishStoryMatch.js';

// Trimmed REST /page/summary fixtures (shape as returned by en.wikipedia.org).
const FIX = {
  moleAnimal: { type: 'standard', title: 'Mole (animal)', description: 'Small burrowing mammal', extract: 'Moles are small mammals adapted to a subterranean lifestyle.' },
  moleSauce: { type: 'standard', title: 'Mole (sauce)', description: 'Mexican sauce and marinade', extract: 'Mole is a traditional sauce and marinade originally used in Mexican cuisine.' },
  moleDisambig: { type: 'disambiguation', title: 'Mole', description: 'Topics referred to by the same term', extract: 'Mole or Molé may refer to:' },
  brambleShrub: { type: 'standard', title: 'Bramble', description: 'Rough, tangled, prickly shrub', extract: 'A bramble is any rough, tangled, prickly shrub, usually in the genus Rubus.' },
  brambleCocktail: { type: 'standard', title: 'Bramble (cocktail)', description: 'Cocktail', extract: 'The Bramble is a cocktail created by Dick Bradsell in 1984 in London.' },
  veloute: { type: 'standard', title: 'Velouté sauce', description: 'French sauce', extract: 'Velouté sauce is a savory sauce, one of the five French mother sauces.' },
  gravy: { type: 'standard', title: 'Gravy', description: 'Sauce made from the juices of meats', extract: 'Gravy is a sauce often made from the juices of meats.' },
  negroni: { type: 'standard', title: 'Negroni', description: 'Italian cocktail', extract: 'The Negroni is a cocktail, made of one part gin, one part vermouth rosso and one part Campari.' },
  enchilada: { type: 'standard', title: 'Enchilada', description: 'Mexican dish', extract: 'An enchilada is a corn tortilla rolled around a filling and covered with a savory sauce.' },
  hurricaneStorm: { type: 'standard', title: 'Tropical cyclone', description: 'Rapidly rotating storm system', extract: 'A tropical cyclone is a rapidly rotating storm system.' },
  goldenBoyFilm: { type: 'standard', title: 'Golden Boy (1939 film)', description: '1939 film by Rouben Mamoulian', extract: 'Golden Boy is a 1939 American drama film.' },
};

describe('normalisation', () => {
  it('folds accents and punctuation', () => {
    expect(fold('Velouté')).toBe('veloute');
    expect(fold('Ti’ Punch')).toBe('ti punch');
    expect(fold('AT&T')).toBe('at and t');
  });
  it('drops generic words and stems plurals', () => {
    expect(tokens('Chicken Enchiladas')).toEqual(['chicken', 'enchilada']);
    expect(tokens('Bramble (cocktail)')).toEqual(['bramble']);
  });
  it('cleans variant notes, numbering and slashes off names', () => {
    expect(cleanName('Martini (Very Dry)')).toBe('Martini');
    expect(cleanName('Corpse Reviver #2')).toBe('Corpse Reviver');
    expect(cleanName('Wine Spritz / Improved Wine Spritz')).toBe('Wine Spritz');
    expect(cleanName('Gravy (Southern)')).toBe('Gravy');
  });
});

describe('candidateTitles', () => {
  it('exact title first, then kind qualifiers', () => {
    expect(candidateTitles('Bramble', 'cocktail')).toEqual(['Bramble', 'Bramble (cocktail)', 'Bramble cocktail']);
    expect(candidateTitles('Velouté', 'sauce')).toEqual(['Velouté', 'Velouté (sauce)', 'Velouté sauce', 'Sauce Velouté']);
    expect(candidateTitles('Paella', 'recipe')).toEqual(['Paella', 'Paella (dish)', 'Paella (food)']);
  });
  it('does not double the kind word', () => {
    expect(candidateTitles('Tomato Sauce (Classic French)', 'sauce')).toEqual(['Tomato Sauce', 'Tomato sauce']);
  });
});

describe('isFoodPage', () => {
  it('accepts food and drink pages', () => {
    for (const k of ['moleSauce', 'brambleCocktail', 'veloute', 'gravy', 'negroni', 'enchilada']) expect(isFoodPage(FIX[k])).toBe(true);
  });
  it('rejects animals, plants, storms and films', () => {
    for (const k of ['moleAnimal', 'brambleShrub', 'hurricaneStorm', 'goldenBoyFilm']) expect(isFoodPage(FIX[k])).toBe(false);
  });
});

describe('namePlausible', () => {
  it('search mode: the title may be more specific, never less', () => {
    expect(namePlausible('Velouté', 'Velouté sauce', 'search')).toBe(true);
    expect(namePlausible('Strawberry Negroni', 'Negroni', 'search')).toBe(false);
    expect(namePlausible('Bloody Mary Verde', 'Bloody Mary (cocktail)', 'search')).toBe(false);
  });
  it('exact mode (a redirect we asked for) accepts containment either way', () => {
    expect(namePlausible('Chicken Enchiladas', 'Enchilada', 'exact')).toBe(true);
    expect(namePlausible('Pina Colada', 'Piña colada', 'exact')).toBe(true);
    expect(namePlausible('Golden Boy', 'Golden Gate Bridge', 'exact')).toBe(false);
  });
  it('override mode always passes', () => {
    expect(namePlausible('Beef Bolognese', 'Bolognese sauce', 'override')).toBe(true);
  });
});

describe('acceptSummary', () => {
  it('"Mole" is the sauce, never the animal or the disambiguation page', () => {
    expect(acceptSummary('Mole Poblano', FIX.moleAnimal, 'exact').ok).toBe(false);
    expect(acceptSummary('Mole Poblano', FIX.moleDisambig, 'exact').reason).toBe('disambiguation');
    expect(acceptSummary('Mole Poblano', FIX.moleSauce, 'exact').ok).toBe(true);
  });
  it('"Bramble" is the cocktail, not the shrub', () => {
    expect(acceptSummary('Bramble', FIX.brambleShrub, 'exact').reason).toBe('not-food');
    expect(acceptSummary('Bramble', FIX.brambleCocktail, 'exact').ok).toBe(true);
  });
  it('"Gravy (Southern)" maps to Gravy; "Velouté" to Velouté sauce', () => {
    expect(acceptSummary('Gravy (Southern)', FIX.gravy, 'exact').ok).toBe(true);
    expect(acceptSummary('Velouté', FIX.veloute, 'search').ok).toBe(true);
  });
  it('a house riff does not inherit its parent via search', () => {
    expect(acceptSummary('Strawberry Negroni', FIX.negroni, 'search').reason).toBe('name-mismatch');
  });
  it('an override still has to be food and not a disambiguation page', () => {
    expect(acceptSummary('Hurricane', FIX.hurricaneStorm, 'override').ok).toBe(false);
    expect(acceptSummary('Mole', FIX.moleDisambig, 'override').ok).toBe(false);
  });
  it('rejects a missing summary', () => {
    expect(acceptSummary('X', null).ok).toBe(false);
  });
});

describe('text trimming', () => {
  it('does not split on abbreviations or initials', () => {
    expect(splitSentences('It dates to c. 1700 in St. Louis. Then it spread.')).toEqual(['It dates to c. 1700 in St. Louis.', 'Then it spread.']);
    expect(splitSentences('Created by H. L. Mencken. Popular.')).toEqual(['Created by H. L. Mencken.', 'Popular.']);
  });
  it('keeps at most two sentences and ~300 characters', () => {
    const t = 'One sentence here. Two sentence here. Three sentence here.';
    expect(firstSentences(t, 2, 300)).toBe('One sentence here. Two sentence here.');
    const long = `${'word '.repeat(100)}end.`;
    const out = firstSentences(long, 2, 300);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.endsWith('…')).toBe(true);
  });
  it('drops the second sentence when it would overflow', () => {
    const t = `A${'a'.repeat(199)}. B${'b'.repeat(149)}.`;
    expect(firstSentences(t, 2, 300)).toBe(`A${'a'.repeat(199)}.`);
  });
});

describe('images and licences', () => {
  it('reads the Commons file name and refuses enwiki-hosted (non-free) files', () => {
    expect(commonsFileFromUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/ChickRedMole.JPG/330px-ChickRedMole.JPG')).toBe('ChickRedMole.JPG');
    expect(commonsFileFromUrl('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Caf%C3%A9.jpg/3840px-Caf%C3%A9.jpg?utm_source=x')).toBe('Café.jpg');
    expect(commonsFileFromUrl('https://upload.wikimedia.org/wikipedia/commons/a/a1/Plain.jpg')).toBe('Plain.jpg');
    expect(commonsFileFromUrl('https://upload.wikimedia.org/wikipedia/en/a/ab/Logo.png')).toBeNull();
    expect(commonsFileFromUrl('')).toBeNull();
  });
  it('accepts only CC0, public domain, CC BY and CC BY-SA', () => {
    for (const ok of ['CC0', 'Public domain', 'PD-US', 'CC BY 2.0', 'CC BY-SA 4.0', 'CC-BY-SA-3.0']) expect(isFreeLicense(ok)).toBe(true);
    for (const no of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', 'Fair use', 'Non-free', '', 'All rights reserved', 'GFDL']) expect(isFreeLicense(no)).toBe(false);
  });
  it('strips HTML and entities from artist credits', () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane&nbsp;Doe</a> &amp; co')).toBe('Jane Doe & co');
    expect(cleanArtist('<span>Photo by: Ann</span>')).toBe('Ann');
    expect(cleanArtist('x'.repeat(30) + ' ' + 'y'.repeat(80)).length).toBeLessThanOrEqual(80);
  });
});

// Rules added after the by-eye review of the first build (docs/dish-stories.md).
describe('review-driven rules', () => {
  it('rejects pages that only name the food in their own title (albums, distilleries)', () => {
    const album = { type: 'standard', title: 'Chocolate Chip Cookies (album)', description: '1996 studio album by Leslie Spit Treeo', extract: 'Chocolate Chip Cookies is an album by Leslie Spit Treeo.' };
    const mixtape = { type: 'standard', title: 'Mac & Cheese 3', description: 'Album by French Montana', extract: 'Mac & Cheese 3 is a mixtape.' };
    const distillery = { type: 'standard', title: 'Loch Lomond distillery', description: 'Whisky distillery in Alexandria, Scotland', extract: 'Loch Lomond distillery makes whisky.' };
    for (const p of [album, mixtape, distillery]) expect(isFoodPage(p)).toBe(false);
  });
  it('accepts pizza, paste, pork and cuts of meat', () => {
    expect(isFoodPage({ title: 'Pizza Margherita', description: 'Neapolitan style pizza', extract: '' })).toBe(true);
    expect(isFoodPage({ title: 'Harissa', description: 'Tunisian hot chili pepper paste', extract: '' })).toBe(true);
    expect(isFoodPage({ title: 'Spare ribs', description: 'Pork ribs variety', extract: '' })).toBe(true);
  });
  it('tries a sentence-case title (Wikipedia is case-sensitive after the first letter)', () => {
    expect(sentenceCase('Mac and Cheese')).toBe('Mac and cheese');
    expect(candidateTitles('Mac and Cheese', 'recipe').slice(0, 2)).toEqual(['Mac and Cheese', 'Mac and cheese']);
  });
  it('accepts spelling-variant redirects, not unrelated ones', () => {
    expect(similarity('Shakshuka', 'Shakshouka')).toBeGreaterThan(0.8);
    expect(namePlausible('Osso Buco', 'Ossobuco', 'exact')).toBe(true);
    expect(namePlausible('Mujadara', 'Mujaddara', 'exact')).toBe(true);
    expect(namePlausible('Godmother', 'Godfather (cocktail)', 'exact')).toBe(false);
  });
  it('cleans Commons artist residue and refuses non-artists', () => {
    expect(cleanArtist('Jon Sullivan The original uploader was Y6y6y6 at English Wikipedia .')).toBe('Jon Sullivan');
    expect(cleanArtist('Skyler Lewis ( w:en:User:Double.reed )')).toBe('Skyler Lewis');
    expect(cleanArtist('User:Justinc')).toBe('Justinc');
    expect(cleanArtist('User JayKeaton on English Wikipedia, http://en.wikipedia.org/wiki/User:JayKeaton')).toBe('JayKeaton');
    expect(cleanArtist('https://www.flickr.com/people/garyjwood/')).toBe('garyjwood (Flickr)');
    expect(cleanArtist('No machine-readable author provided. Charbel assumed (based on copyright claims).')).toBe('Charbel (assumed)');
    expect(cleanArtist('Simon Law (sfllaw) from Montréal , QC , Canada')).toBe('Simon Law (sfllaw) from Montréal, QC, Canada');
    expect(cleanArtist('Ɱ')).toBe('Ɱ');
    for (const no of ['Unknown author Unknown author', 'trabajo propio', 'Own work', '']) expect(cleanArtist(no)).toBe('');
  });
  it('tidies extract residue', () => {
    expect(tidyText('Sushi is rice , typically ( ; ) seasoned.')).toBe('Sushi is rice, typically seasoned.');
  });
});
