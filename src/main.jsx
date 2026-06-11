import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';
import { initNative } from './utils/native.js';

const root = createRoot(document.getElementById('root'));
root.render(<><App /><UpdateBanner /></>);

// One-shot native boot — hides the iOS launch splash and pins the
// status bar style. No-op when running in a browser tab.
initNative();
