import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/command-center.css';
import './styles/ultra-hd.css';
import './styles/mobile-ops.css';
import './styles/ultra-hd-tuning.css';
import './styles/wallboard-v2.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
