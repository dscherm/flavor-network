// DEV ONLY: reached at /?picture-dev under `npm run dev`; main.jsx only imports it when
// import.meta.env.DEV, so it is not part of the production build.
import { useState } from 'react';
import RecipePicture from '../components/RecipePicture.jsx';
import { PictureArt, allPictureIds, pictureLabel } from '../components/pictureArt.jsx';

import { TEXT } from '../data/chalkTheme.js';
const SIZES = [24, 64, 120];
const NEW_IDS = allPictureIds().filter((id) => !id.startsWith('dish:'));

export default function PictureDevPage() {
  const [kind, setKind] = useState('cocktail');
  const [value, setValue] = useState(null);
  const shown = value?.kind === 'chalk' ? { ...value, blob: undefined } : value;
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', background: '#1c1c1c', color: '#f5efde', padding: 16, boxSizing: 'border-box', fontFamily: TEXT }}>
      <h1 style={{ fontSize: 18 }}>Picture dev harness</h1>
      <div id="sheet">
        {[...NEW_IDS, 'dish:pasta', 'dish:soup', 'nope:unknown'].map((id) => (
          <div key={id} data-sheet-id={id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0', borderBottom: '1px solid #4a4a4a' }}>
            <span style={{ width: 110, fontSize: 13 }}>{id}{pictureLabel(id) ? '' : ' (fallback)'}</span>
            {SIZES.map((s) => (
              <span key={s} style={{ width: 130, display: 'inline-flex', justifyContent: 'center', outline: '1px dashed #333' }}>
                <PictureArt id={id} size={s} />
              </span>
            ))}
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 16, marginTop: 24 }}>Chooser</h2>
      <div style={{ marginBottom: 8 }}>
        {['dish', 'cocktail', 'sauce'].map((k) => (
          <button key={k} onClick={() => setKind(k)} style={{ marginRight: 8, minHeight: 44, minWidth: 44, color: '#f5efde', border: '1px solid #8a8478', background: k === kind ? '#333' : 'transparent' }}>{k}</button>
        ))}
      </div>
      <div style={{ maxWidth: 375 }}>
        <RecipePicture kind={kind} value={value} onChange={setValue} />
      </div>
      <pre id="picture-value" style={{ fontSize: 12 }}>{JSON.stringify(shown)}</pre>
    </div>
  );
}
