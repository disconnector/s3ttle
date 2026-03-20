/**
 * main.tsx — React entry point.
 *
 * IMPORTANT: We call applyPreferences() BEFORE createRoot/render so the
 * correct theme class and CSS variables are on the DOM before the first
 * paint. This prevents a flash of the wrong theme or default font.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { getPreferences, applyPreferences } from './lib/preferences';

// Apply saved preferences to the DOM immediately — before React mounts.
// This sets the 'dark' class on <html> and injects any Google Font link tag,
// so the user never sees an unstyled or wrong-theme flash.
applyPreferences(getPreferences());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
