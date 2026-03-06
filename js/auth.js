/**
 * auth.js
 * Handles Google Identity Services (GIS) OAuth 2.0 token flow.
 * Uses the modern tokenClient (implicit grant) — no redirect needed.
 *
 * Token is persisted in sessionStorage so navigating between pages
 * in the same browser session does not require a repeat sign-in.
 */

const Auth = (() => {

  const SCOPE      = 'https://www.googleapis.com/auth/spreadsheets';
  const TOKEN_KEY  = '122jm_access_token';
  const EXPIRY_KEY = '122jm_token_expiry';

  let tokenClient = null;
  let accessToken  = null;
  let tokenExpiry  = 0;

  // Page-level callbacks set by init()
  let _onSignedIn  = null;
  let _onSignedOut = null;

  // ── Session storage helpers ─────────────────────────────────────────────

  /** Persist a fresh token so other pages in this session can reuse it. */
  function saveToken() {
    try {
      sessionStorage.setItem(TOKEN_KEY,  accessToken);
      sessionStorage.setItem(EXPIRY_KEY, String(tokenExpiry));
    } catch {}
  }

  /**
   * Try to restore a valid token from sessionStorage.
   * Returns true if a non-expired token was found and loaded into memory.
   */
  function loadToken() {
    try {
      const tok = sessionStorage.getItem(TOKEN_KEY);
      const exp = parseInt(sessionStorage.getItem(EXPIRY_KEY) || '0', 10);
      if (tok && Date.now() < exp) {
        accessToken = tok;
        tokenExpiry = exp;
        return true;
      }
    } catch {}
    return false;
  }

  /** Remove any stored token (on sign-out or error). */
  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXPIRY_KEY);
    } catch {}
    accessToken = null;
    tokenExpiry  = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Called once by each page after the GIS script loads. */
  function init(onSignedIn, onSignedOut) {
    if (!Config.isConfigured()) return;
    _onSignedIn  = onSignedIn;
    _onSignedOut = onSignedOut;

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: Config.get('clientId'),
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          console.error('GIS error', response);
          clearToken();
          _onSignedOut();
          return;
        }
        accessToken = response.access_token;
        // GIS tokens expire in ~1 hour (3600s). Store with 60s buffer.
        tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
        saveToken();          // ← persist so other pages skip the sign-in
        _onSignedIn(accessToken);
      },
    });
  }

  /**
   * Sign in. Checks sessionStorage first so navigating between pages
   * within the same browser session reuses the existing token instantly.
   */
  function signIn() {
    if (!tokenClient) {
      alert('Please configure Google Sheets credentials first (⚙ Sheets Settings).');
      return;
    }
    // Already signed in (in-memory)
    if (accessToken && Date.now() < tokenExpiry) return;

    // Token from another page in this session — reuse immediately
    if (loadToken()) {
      _onSignedIn(accessToken);
      return;
    }

    // Request a new token; prompt:'' = silent if Google session is active
    tokenClient.requestAccessToken({ prompt: '' });
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    clearToken();
  }

  function getToken() {
    if (!accessToken || Date.now() >= tokenExpiry) return null;
    return accessToken;
  }

  function isSignedIn() {
    return !!(accessToken && Date.now() < tokenExpiry);
  }

  /**
   * Ensure a valid token is available before an API call.
   * Checks memory → sessionStorage → silent GIS refresh, in that order.
   */
  function ensureToken() {
    return new Promise((resolve, reject) => {
      // In-memory token still valid
      if (isSignedIn()) { resolve(getToken()); return; }

      // Try sessionStorage (covers page-navigation case)
      if (loadToken()) { resolve(getToken()); return; }

      if (!tokenClient) { reject(new Error('Not configured')); return; }

      // Silent GIS refresh
      const originalCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = originalCallback;
        if (resp.error) { reject(new Error(resp.error)); return; }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
        saveToken();
        resolve(accessToken);
      };
      tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  return { init, signIn, signOut, getToken, isSignedIn, ensureToken };
})();
