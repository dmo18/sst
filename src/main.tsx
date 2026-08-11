import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/command-center.css';
import './styles/ultra-hd.css';
import './styles/mobile-ops.css';
import './styles/ultra-hd-tuning.css';
import './styles/premium-experience.css';
import './styles/premium-interactions.css';
import './styles/premium-icons.css';
import './styles/wallboard-v2.css';
import './styles/wallboard-compat.css';
import './styles/wallboard-tv.css';
import './styles/wallboard-premium.css';

if (!('CSSLayerBlockRule' in window)) {
  document.documentElement.classList.add('no-css-layers');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);