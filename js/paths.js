/**
 * Resolve app URLs for GitHub Pages (/Insova) and local development.
 */

/** @returns {string} Base path without trailing slash, e.g. "/Insova" or "" */
export function getAppBase() {
  const path = window.location.pathname;
  if (path === '/Insova' || path.startsWith('/Insova/')) return '/Insova';
  return '';
}

/** Build a root-relative URL that works locally and on GitHub Pages. */
export function appPath(relativePath) {
  const clean = relativePath.replace(/^\//, '');
  const base = getAppBase();
  return base ? `${base}/${clean}` : `/${clean}`;
}
