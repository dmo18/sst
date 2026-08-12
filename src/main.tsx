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
import './styles/premium-state.css';
import './styles/premium-mobile.css';
import './styles/premium-final-polish.css';
import './styles/product-depth.css';
import './styles/product-depth-launcher.css';
import './styles/microsoft365-critical-suite.css';
import './styles/microsoft365-truth-hardening.css';
import './styles/product-depth-final-polish.css';
import './styles/product-quality-cleanup.css';
import './styles/provider-identity.css';
import './styles/wallboard-v2.css';
import './styles/wallboard-compat.css';
import './styles/wallboard-tv.css';
import './styles/wallboard-premium.css';
import './styles/wallboard-truth-hardening.css';

if (!('CSSLayerBlockRule' in window)) {
  document.documentElement.classList.add('no-css-layers');
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
