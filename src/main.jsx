import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import UpdateBanner from './components/UpdateBanner.jsx';

const root = createRoot(document.getElementById('root'));
root.render(<><App /><UpdateBanner /></>);
