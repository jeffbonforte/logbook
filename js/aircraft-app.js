/**
 * aircraft-app.js
 * Aircraft reference page: static specs + editable maintenance & admin fields
 * backed by the Google Sheets "Aircraft" tab.
 */

// ── State ───────────────────────────────────────────────────────────────────
let acData = {};            // { field: { value, updated, updatedBy } }
let saveTimers = {};        // debounce timers per field

const COLLAPSE_KEY = '122jm_ac_sections';

// ── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  restoreSectionStates();
  if (Config.isConfigured()) initGIS(onSignedIn, onSignedOut);
  else setTimeout(() => showConfigModal(), 300);
});

// ── Auth ────────────────────────────────────────────────────────────────────
function onSignedIn() {
  $('btn-signin').style.display  = 'none';
  $('btn-signout').style.display = '';
  // Show editable sections
  showEditableSections(true);
  loadAircraftData();
}

function onSignedOut() {
  $('btn-signin').style.display  = '';
  $('btn-signout').style.display = 'none';
  showEditableSections(false);
  acData = {};
}

function showEditableSections(show) {
  const mxGate    = $('ac-auth-gate-mx');
  const mxContent = $('ac-mx-content');
  const adGate    = $('ac-auth-gate-admin');
  const adContent = $('ac-admin-content');
  if (mxGate)    mxGate.style.display    = show ? 'none' : '';
  if (mxContent) mxContent.style.display = show ? ''     : 'none';
  if (adGate)    adGate.style.display    = show ? 'none' : '';
  if (adContent) adContent.style.display = show ? ''     : 'none';
}

// ── Data loading ────────────────────────────────────────────────────────────
async function loadAircraftData() {
  try {
    // Load aircraft fields and flight log in parallel
    const [data, flights] = await Promise.all([
      Sheets.fetchAllAircraftData(),
      Sheets.fetchAll(),
    ]);
    acData = data;

    // Populate editable fields from Sheets data
    document.querySelectorAll('[data-field]').forEach(el => {
      const fieldName = el.getAttribute('data-field');
      if (acData[fieldName]) {
        el.value = acData[fieldName].value;
      }
    });

    // Auto-populate engine hours from latest Hobbs End
    if (flights && flights.length > 0) {
      const last = flights[flights.length - 1];
      const hobbsEnd = last.hobbsEnd;
      const engineInput = $('ac-engine-hours');
      if (engineInput && hobbsEnd != null && !isNaN(hobbsEnd)) {
        engineInput.value = hobbsEnd.toFixed(1) + ' hrs';
      }
    }

    // Check inspection dates for status badges
    updateInspectionStatus();

  } catch (err) {
    console.error('Failed to load aircraft data:', err);
  }
}

// ── Inspection date badges ──────────────────────────────────────────────────
function updateInspectionStatus() {
  ['ac-next-annual', 'ac-next-phase', 'ac-insurance-exp'].forEach(id => {
    const input = $(id);
    if (!input || !input.value) return;
    const date = new Date(input.value);
    const now  = new Date();
    const days = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    // Remove existing badge
    const existing = input.parentElement.querySelector('.ac-date-badge');
    if (existing) existing.remove();

    const badge = document.createElement('span');
    if (days < 0) {
      badge.className = 'ac-date-badge ac-date-overdue';
      badge.textContent = 'OVERDUE';
    } else if (days <= 30) {
      badge.className = 'ac-date-badge ac-date-soon';
      badge.textContent = days + 'd remaining';
    } else if (days <= 90) {
      badge.className = 'ac-date-badge ac-date-upcoming';
      badge.textContent = days + 'd remaining';
    } else {
      badge.className = 'ac-date-badge ac-date-ok';
      badge.textContent = days + 'd remaining';
    }
    input.parentElement.appendChild(badge);
  });
}

// ── Auto-save ───────────────────────────────────────────────────────────────
function setupAutoSave(el) {
  const field = el.getAttribute('data-field');
  if (!field) return;

  const statusEl = el.parentElement.querySelector('.ac-field-status');

  el.addEventListener('input', () => {
    clearTimeout(saveTimers[field]);
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.className = 'ac-field-status';
    }
    saveTimers[field] = setTimeout(() => saveField(field, el.value, statusEl), 800);
  });

  // Also save on blur immediately
  el.addEventListener('blur', () => {
    clearTimeout(saveTimers[field]);
    if (el.value !== (acData[field]?.value || '')) {
      saveField(field, el.value, statusEl);
    }
  });
}

async function saveField(field, value, statusEl) {
  if (statusEl) {
    statusEl.textContent = 'Saving\u2026';
    statusEl.className = 'ac-field-status ac-field-saving';
  }
  try {
    await Sheets.upsertAircraftField({ field, value });
    acData[field] = { value, updated: new Date().toISOString(), updatedBy: '' };

    if (statusEl) {
      statusEl.textContent = 'Saved';
      statusEl.className = 'ac-field-status ac-field-saved';
      setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'ac-field-status';
      }, 2000);
    }

    // Refresh inspection badges if a date field changed
    updateInspectionStatus();

  } catch (err) {
    console.error('Save failed:', field, err);
    if (statusEl) {
      statusEl.textContent = 'Error saving';
      statusEl.className = 'ac-field-status ac-field-error';
    }
  }
}

// ── Section collapse/expand ─────────────────────────────────────────────────
function getSectionStates() {
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; }
  catch { return {}; }
}

function saveSectionStates(states) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(states));
}

function restoreSectionStates() {
  const states = getSectionStates();
  document.querySelectorAll('.ac-section-toggle').forEach(btn => {
    const bodyId = btn.getAttribute('data-section');
    const body   = $(bodyId);
    if (!body) return;
    if (states[bodyId] === false) {
      btn.setAttribute('aria-expanded', 'false');
      body.classList.add('ac-collapsed');
    }
  });
}

function toggleSection(btn) {
  const bodyId   = btn.getAttribute('data-section');
  const body     = $(bodyId);
  if (!body) return;

  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', !expanded);
  body.classList.toggle('ac-collapsed', expanded);

  const states = getSectionStates();
  states[bodyId] = !expanded;
  saveSectionStates(states);
}

// ── Events ──────────────────────────────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  const themeBtn = $('btn-theme');
  if (themeBtn) {
    const cur = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(cur);
    themeBtn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // Auth buttons
  const signIn  = $('btn-signin');
  const signOut = $('btn-signout');
  if (signIn)  signIn.addEventListener('click',  () => Auth.signIn());
  if (signOut) signOut.addEventListener('click', () => Auth.signOut());

  // Section toggles
  document.querySelectorAll('.ac-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => toggleSection(btn));
  });

  // Auto-save on editable fields
  document.querySelectorAll('[data-field]').forEach(el => setupAutoSave(el));

  // Config modal (Sheets Settings)
  const settingsBtn = $('btn-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', showConfigModal);
  const cfgClose  = $('config-modal-close');
  const cfgCancel = $('config-cancel');
  const cfgSave   = $('config-save');
  if (cfgClose)  cfgClose.addEventListener('click', hideConfigModal);
  if (cfgCancel) cfgCancel.addEventListener('click', hideConfigModal);
  if (cfgSave)   cfgSave.addEventListener('click', doConfigSave);
}

// ── Config Modal ────────────────────────────────────────────────────────────
function showConfigModal() {
  const m = $('config-modal');
  if (!m) return;
  $('cfg-client-id').value = Config.get('clientId');
  $('cfg-sheet-id').value  = Config.get('sheetId');
  m.style.display = 'flex';
}

function hideConfigModal() {
  const m = $('config-modal');
  if (m) m.style.display = 'none';
}

function doConfigSave() {
  const clientId = $('cfg-client-id').value.trim();
  const sheetId  = $('cfg-sheet-id').value.trim();
  if (!clientId || !sheetId) {
    const err = $('config-error');
    if (err) { err.textContent = 'Both fields are required.'; err.style.display = ''; }
    return;
  }
  Config.set({ clientId, sheetId });
  hideConfigModal();
  location.reload();
}
