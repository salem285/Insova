/**
 * App bootstrap — shared initialization for all pages
 * Detects page context via [data-page] on <body> and loads the appropriate module.
 */

import { initTheme } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  const page = document.body.dataset.page;
  if (!page) return;

  try {
    switch (page) {
      case 'registration':
        await import('./registration.js');
        break;
      case 'admin-login':
        await import('./auth.js');
        break;
      case 'dashboard':
        await import('./dashboard.js');
        break;
      default:
        console.warn(`Unknown page context: ${page}`);
    }
  } catch (err) {
    console.error('Failed to load page module:', err);
  }
});
