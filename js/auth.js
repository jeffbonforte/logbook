/**
 * auth.js
 * Handles Google Identity Services (GIS) OAuth 2.0 token flow.
 * Uses the modern tokenClient (implicit grant) — no redirect needed.
 */

const Auth = (() => {

  const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

  let tokenClient = null;
  let accessToken  = null;
  let tokenExpiry  = 0;

  // Called once by app.js after GIS script loads
  function init(onSignedIn, onSignedOut) {
    if (!Config.isConfigured()) return;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: Config.get('clientId'),
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          console.error('GIS error', response);
          onSignedOut();
          return;
        }
        accessToken = response.access_token;
        // GIS tokens expire in ~1 hour (3600s). Store expiry with 60s buffer.
        tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
        onSignedIn(accessToken);
      },
    });
  }

  function signIn() {
    if (!tokenClient) {
      alert('Please configure Google Sheets credentials first (⚙ Sheets Settings).');
      return;
    }
    // If token is fresh, skip the consent screen
    if (accessToken && Date.now() < tokenExpiry) {
      // already good — just trigger the callback path
      // (this shouldn't normally be called when already signed in)
      return;
    }
    tokenClient.requestAccessToken({ prompt: '' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    tokenExpiry  = 0;
  }

  function getToken() {
    if (!accessToken || Date.now() >= tokenExpiry) return null;
    return accessToken;
  }

  function isSignedIn() {
    return !!(accessToken && Date.now() < tokenExpiry);
  }

  // Silently refreshes the token if it has expired
  function ensureToken() {
    return new Promise((resolve, reject) => {
      if (isSignedIn()) { resolve(getToken()); return; }
      if (!tokenClient) { reject(new Error('Not configured')); return; }
      // Override callback temporarily to resolve the promise
      const originalCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = originalCallback;
        if (resp.error) { reject(new Error(resp.error)); return; }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
        resolve(accessToken);
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  return { init, signIn, signOut, getToken, isSignedIn, ensureToken };
})();
