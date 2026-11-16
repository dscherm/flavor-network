import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { parseSharePath } from './data/sharedRecipe.js';
import ConsentBanner from './components/ConsentBanner.jsx';
import { initUsage } from './data/usage.js';
import { lazyWithRetry } from './utils/lazyWithRetry.js';

// /r/... is a public shared recipe: it replaces the app shell, so the landing picker
// and the 27 MB pairing dataset (loaded by App's useProData) are never touched.
const SharedRecipePage = lazyWithRetry(() => import('./components/SharedRecipePage.jsx'));
const PrivacyPage = lazyWithRetry(() => import('./components/PrivacyPage.jsx'));
const shareRoute = parseSharePath(window.location.pathname);
const isPrivacy = /^\/privacy\/?$/.test(window.location.pathname);

initUsage();

const root = createRoot(document.getElementById('root'));
// Dev-only harness for the picture chooser (PICTURE-2): `npm run dev`, then /?picture-dev.
// import.meta.env.DEV is false in a production build, so the page and this branch are dropped.
const PictureDevPage = import.meta.env.DEV && window.location.search.includes('picture-dev')
  ? lazyWithRetry(() => import('./dev/PictureDevPage.jsx'))
  : null;
root.render(PictureDevPage
  ? <Suspense fallback={null}><PictureDevPage /></Suspense>
  : isPrivacy
  ? <><Suspense fallback={null}><PrivacyPage /></Suspense></>
  : shareRoute
    ? <><Suspense fallback={null}><SharedRecipePage route={shareRoute} /></Suspense><ConsentBanner /></>
    : <><App /><UpdateBanner /><ConsentBanner /></>);
