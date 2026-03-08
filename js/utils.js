/**
 * utils.js
 * Shared utilities used by all 122JM pages.
 * Load this before any other app scripts.
 */

/** DOM query shorthand. */
const $ = id => document.getElementById(id);

/** Safely escape HTML special characters. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** localStorage key for the current colour theme. */
const THEME_KEY = '122jm_theme';

/**
 * Apply and persist a theme ('dark' | 'light').
 * Also updates the #btn-theme button label/tooltip.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('btn-theme');
  if (btn) {
    btn.innerHTML = theme === 'light' ? '&#9790;' : '&#9728;';
    btn.title     = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  }
  localStorage.setItem(THEME_KEY, theme);
}
