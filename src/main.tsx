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
import './styles/product-depth-final-polish.css';
import './styles/provider-identity.css';
import './styles/wallboard-v2.css';
import './styles/wallboard-compat.css';
import './styles/wallboard-tv.css';
import './styles/wallboard-premium.css';

if (!('CSSLayerBlockRule' in window)) {
  document.documentElement.classList.add('no-css-layers');
}

function keepDesktopDevicesOutOfCompactShell(): void {
  if (window.matchMedia('(max-device-width: 900px)').matches) return;

  const compactQueries = new Map([
    ['(max-width: 900px)', '(max-width: 900px) and (max-device-width: 900px)'],
    ['(max-width: 370px)', '(max-width: 370px) and (max-device-width: 370px)']
  ]);

  const rewriteRules = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const replacement = compactQueries.get(rule.media.mediaText);
        if (replacement) rule.media.mediaText = replacement;
      }
      const nested = 'cssRules' in rule ? (rule as CSSGroupingRule).cssRules : undefined;
      if (nested) rewriteRules(nested);
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      rewriteRules(sheet.cssRules);
    }
    catch {
      // All application stylesheets are same-origin. Ignore an inaccessible sheet
      // rather than weakening CSP or blocking application startup.
    }
  }
}

keepDesktopDevicesOutOfCompactShell();

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
