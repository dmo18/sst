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

const STYLESHEET_READY_TIMEOUT_MS = 5_000;

async function waitForApplicationStylesheets(): Promise<void> {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  const pending = links
    .filter(link => !link.sheet)
    .map(link => new Promise<void>(resolve => {
      const finish = (): void => resolve();
      link.addEventListener('load', finish, { once: true });
      link.addEventListener('error', finish, { once: true });
    }));

  if (pending.length === 0) return;

  await Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>(resolve => window.setTimeout(resolve, STYLESHEET_READY_TIMEOUT_MS))
  ]);
}

async function keepDesktopDevicesOutOfCompactShell(): Promise<void> {
  if (window.matchMedia('(max-device-width: 900px)').matches) return;

  await waitForApplicationStylesheets();

  const compactQueries = new Map([
    ['(max-width: 900px)', '(max-width: 900px) and (max-device-width: 900px)'],
    ['(max-width: 370px)', '(max-width: 370px) and (max-device-width: 370px)']
  ]);
  let rewrittenRules = 0;

  const rewriteRules = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        const replacement = compactQueries.get(rule.media.mediaText);
        if (replacement) {
          rule.media.mediaText = replacement;
          rewrittenRules += 1;
        }
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
      // Application stylesheets are same-origin in production. If a browser exposes
      // an inaccessible sheet, leave it untouched rather than weakening CSP.
    }
  }

  document.documentElement.dataset.desktopShellGuard = String(rewrittenRules);
}

async function startApplication(): Promise<void> {
  await keepDesktopDevicesOutOfCompactShell();

  createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void startApplication();
