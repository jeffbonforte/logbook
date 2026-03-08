/**
 * bootstrap.js
 * Shared Google Identity Services (GIS) initialisation used by all pages.
 * Load this after config.js, auth.js, and before the page-specific app script.
 */

/**
 * Dynamically load the GIS library and wire up Auth callbacks.
 * Call this once the app is configured (Config.isConfigured() === true).
 *
 * @param {Function} onSignedIn  - Called when a valid token is obtained.
 * @param {Function} onSignedOut - Called when the user signs out or auth fails.
 */
function initGIS(onSignedIn, onSignedOut) {
  window.onGISLoad = function () {
    Auth.init(onSignedIn, onSignedOut);
    if (Config.isConfigured()) Auth.signIn();
  };
  const script   = document.createElement('script');
  script.src     = 'https://accounts.google.com/gsi/client';
  script.async   = true;
  script.defer   = true;
  script.onload  = window.onGISLoad;
  document.head.appendChild(script);
}
