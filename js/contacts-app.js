/**
 * contacts-app.js
 * UI controller for the 122JM Contacts directory.
 */

// ── Category config ─────────────────────────────────────────────────────────

const CONTACT_CATEGORIES = [
  'Partner', 'Pilot', 'Maintenance', 'Avionics', 'Fuel', 'FBO',
  'Detailing', 'Insurance', 'Parts', 'Charter', 'Legal', 'Other',
];

const CATEGORY_CLASS = {
  'Partner':     'cat-c11',
  'Pilot':       'cat-c0',
  'Maintenance': 'cat-c1',
  'Avionics':    'cat-c2',
  'Fuel':        'cat-c3',
  'FBO':         'cat-c4',
  'Detailing':   'cat-c5',
  'Insurance':   'cat-c6',
  'Parts':       'cat-c7',
  'Charter':     'cat-c8',
  'Legal':       'cat-c9',
  'Other':       'cat-c10',
};

function catClass(cat) { return CATEGORY_CLASS[cat] || 'cat-c10'; }

// ── State ───────────────────────────────────────────────────────────────────

let allContacts    = [];
let editingContact = null;
let deleteTarget   = null;

// ── DOM refs ────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const authPrompt      = $('auth-prompt');
const appContent      = $('app-content');
const btnSignin       = $('btn-signin');
const btnSigninCard   = $('btn-signin-card');
const btnSignout      = $('btn-signout');
const btnAddContact   = $('btn-add-contact');
const btnRefresh      = $('btn-refresh');
const contactsGrid    = $('contacts-grid');
const contactsEmpty   = $('contacts-empty');
const contactsLoading = $('contacts-loading');
const contactCountEl  = $('contact-count');

const contactModal       = $('contact-modal');
const contactForm        = $('contact-form');
const contactModalTitle  = $('contact-modal-title');
const contactModalSubmit = $('contact-modal-submit');
const contactFormError   = $('contact-form-error');

const deleteModal = $('delete-modal');
const deleteBody  = $('delete-modal-body');

const configModal = $('config-modal');

// ── Bootstrap ───────────────────────────────────────────────────────────────

window.onGISLoad = function () {
  Auth.init(onSignedIn, onSignedOut);
  if (Config.isConfigured()) Auth.signIn();
};

function initGIS() {
  const script = document.createElement('script');
  script.src   = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = window.onGISLoad;
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (Config.isConfigured()) {
    initGIS();
  } else {
    setTimeout(() => showConfigModal(), 300);
  }
});

// ── Auth state handlers ─────────────────────────────────────────────────────

function onSignedIn() {
  btnSignin.style.display    = 'none';
  btnSignout.style.display   = '';
  btnAddContact.disabled     = false;
  authPrompt.style.display   = 'none';
  appContent.style.display   = '';
  loadContacts();
}

function onSignedOut() {
  btnSignin.style.display    = '';
  btnSignout.style.display   = 'none';
  btnAddContact.disabled     = true;
  authPrompt.style.display   = '';
  appContent.style.display   = 'none';
  allContacts = [];
}

// ── Data loading ────────────────────────────────────────────────────────────

async function loadContacts() {
  contactsLoading.style.display = '';
  contactsEmpty.style.display   = 'none';
  contactsGrid.innerHTML        = '';
  try {
    allContacts = await Sheets.fetchAllContacts();
    renderCards();
  } catch (err) {
    contactsEmpty.textContent    = `Error: ${err.message}`;
    contactsEmpty.style.display  = '';
  } finally {
    contactsLoading.style.display = 'none';
  }
}

// ── Filtering ───────────────────────────────────────────────────────────────

function getFiltered() {
  const search   = $('search-input').value.trim().toLowerCase();
  const category = $('filter-category').value;

  return allContacts.filter(c => {
    if (category && !c.categories.includes(category)) return false;
    if (search) {
      const apInfo = c.airport ? Airports.lookup(c.airport) : null;
      const hay = [
        c.name,
        c.phone,
        c.email,
        c.airport,
        apInfo ? `${apInfo.name} ${apInfo.city} ${apInfo.state}` : '',
        c.categories.join(' '),
        c.notes,
      ].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderCards() {
  const filtered = getFiltered().slice().sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  contactCountEl.textContent = `${filtered.length} of ${allContacts.length} contacts`;

  if (filtered.length === 0) {
    contactsGrid.innerHTML     = '';
    contactsEmpty.style.display = '';
    contactsEmpty.textContent  = allContacts.length === 0
      ? 'No contacts yet. Click "+ Add Contact" to add the first entry.'
      : 'No contacts match your search.';
    return;
  }
  contactsEmpty.style.display = 'none';

  contactsGrid.innerHTML = filtered.map(c => {
    const catBadges = c.categories.map(cat =>
      `<span class="cat-badge ${catClass(cat)}">${esc(cat)}</span>`
    ).join('');

    const apInfo = c.airport ? Airports.lookup(c.airport) : null;
    const apLabel = apInfo
      ? `${esc(c.airport)}<span class="contact-airport-name">— ${esc(apInfo.name)}, ${esc(apInfo.city)}</span>`
      : esc(c.airport);

    const details = [
      c.phone   ? `<div class="contact-detail-row">
                     <span class="contact-detail-label">Ph</span>
                     <span class="contact-detail-val"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></span>
                   </div>` : '',
      c.email   ? `<div class="contact-detail-row">
                     <span class="contact-detail-label">Em</span>
                     <span class="contact-detail-val"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></span>
                   </div>` : '',
      c.airport ? `<div class="contact-detail-row">
                     <span class="contact-detail-label">Apt</span>
                     <span class="contact-detail-val">${apLabel}</span>
                   </div>` : '',
    ].filter(Boolean).join('');

    const notes = c.notes
      ? `<div class="contact-notes">${esc(c.notes)}</div>`
      : '';

    return `
      <div class="contact-card" data-row="${c._row}">
        <div class="contact-card-top">
          <div class="contact-name">${esc(c.name)}</div>
          <div class="contact-card-actions">
            <button class="btn-icon" title="Edit"   onclick="openEditModal(${c._row})">&#9998;</button>
            <button class="btn-icon danger" title="Delete" onclick="openDeleteModal(${c._row})">&#10005;</button>
          </div>
        </div>
        ${catBadges ? `<div class="contact-cats">${catBadges}</div>` : ''}
        ${details   ? `<div class="contact-details">${details}</div>` : ''}
        ${notes}
      </div>`;
  }).join('');
}

// ── Add / Edit Modal ─────────────────────────────────────────────────────────

function openAddModal() {
  editingContact = null;
  contactModalTitle.textContent  = 'Add Contact';
  contactModalSubmit.textContent = 'Save Contact';
  contactForm.reset();
  clearCategoryChecks();
  hideContactFormError();
  contactModal.style.display = 'flex';
  $('c-name').focus();
}

function openEditModal(sheetRow) {
  const c = allContacts.find(x => x._row === sheetRow);
  if (!c) return;
  editingContact = c;

  contactModalTitle.textContent  = `Edit — ${c.name}`;
  contactModalSubmit.textContent = 'Update Contact';
  hideContactFormError();

  $('c-name').value    = c.name;
  $('c-phone').value   = c.phone;
  $('c-email').value   = c.email;
  $('c-airport').value = c.airport;
  $('c-notes').value   = c.notes;

  // Set category checkboxes
  document.querySelectorAll('[name="cat"]').forEach(cb => {
    cb.checked = c.categories.includes(cb.value);
  });

  contactModal.style.display = 'flex';
  $('c-name').focus();
}

function closeContactModal() {
  contactModal.style.display = 'none';
  editingContact = null;
}

function clearCategoryChecks() {
  document.querySelectorAll('[name="cat"]').forEach(cb => { cb.checked = false; });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  hideContactFormError();

  const name = $('c-name').value.trim();
  if (!name) return showContactFormError('Name is required.');

  const categories = [...document.querySelectorAll('[name="cat"]:checked')].map(cb => cb.value);

  const contact = {
    ...(editingContact || {}),
    name,
    categories,
    phone:   $('c-phone').value.trim(),
    email:   $('c-email').value.trim(),
    airport: Airports.canonicalize($('c-airport').value),
    notes:   $('c-notes').value.trim(),
  };

  contactModalSubmit.disabled    = true;
  contactModalSubmit.textContent = editingContact ? 'Saving…' : 'Adding…';

  try {
    if (editingContact) {
      await Sheets.updateContact(contact);
      const idx = allContacts.findIndex(x => x._row === contact._row);
      if (idx !== -1) allContacts[idx] = contact;
    } else {
      await Sheets.appendContact(contact);
      allContacts = await Sheets.fetchAllContacts();
    }
    closeContactModal();
    renderCards();
  } catch (err) {
    showContactFormError(err.message);
  } finally {
    contactModalSubmit.disabled    = false;
    contactModalSubmit.textContent = editingContact ? 'Update Contact' : 'Save Contact';
  }
}

function showContactFormError(msg) {
  contactFormError.textContent   = msg;
  contactFormError.style.display = '';
}
function hideContactFormError() {
  contactFormError.style.display = 'none';
  contactFormError.textContent   = '';
}

// ── Delete Modal ─────────────────────────────────────────────────────────────

function openDeleteModal(sheetRow) {
  const c = allContacts.find(x => x._row === sheetRow);
  if (!c) return;
  deleteTarget = c;
  deleteBody.textContent = `Delete "${c.name}"? This cannot be undone.`;
  deleteModal.style.display = 'flex';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  deleteTarget = null;
}

async function handleDeleteConfirm() {
  if (!deleteTarget) return;
  const btn = $('delete-confirm');
  btn.disabled    = true;
  btn.textContent = 'Deleting…';
  try {
    await Sheets.deleteContact(deleteTarget);
    allContacts = await Sheets.fetchAllContacts();
    closeDeleteModal();
    renderCards();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Delete';
  }
}

// ── Config Modal ─────────────────────────────────────────────────────────────

function showConfigModal() {
  const cfg = Config.load();
  $('cfg-client-id').value             = cfg.clientId           || '';
  $('cfg-sheet-id').value              = cfg.sheetId            || '';
  $('cfg-contacts-sheet-name').value   = cfg.contactsSheetName  || 'Contacts';
  $('config-error').style.display      = 'none';
  configModal.style.display            = 'flex';
}

function closeConfigModal() {
  configModal.style.display = 'none';
}

function saveConfig() {
  const clientId           = $('cfg-client-id').value.trim();
  const sheetId            = $('cfg-sheet-id').value.trim();
  const contactsSheetName  = $('cfg-contacts-sheet-name').value.trim() || 'Contacts';

  if (!clientId || !sheetId) {
    $('config-error').textContent   = 'OAuth Client ID and Spreadsheet ID are required.';
    $('config-error').style.display = '';
    return;
  }
  Config.set({ clientId, sheetId, contactsSheetName });
  closeConfigModal();
  initGIS();
}

// ── Search Autosuggest ────────────────────────────────────────────────────────

function initSearchAutocomplete() {
  const input = $('search-input');
  let dropdown  = null;
  let options   = [];
  let activeIdx = -1;

  function createDropdown() {
    const el = document.createElement('div');
    el.className = 'search-dropdown';
    el.style.display = 'none';
    input.parentElement.appendChild(el);
    return el;
  }

  function closeDropdown() {
    if (dropdown) dropdown.style.display = 'none';
    options = []; activeIdx = -1;
  }

  function setActive(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.search-option');
    items.forEach(o => o.classList.remove('active'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('active');
      items[idx].scrollIntoView({ block: 'nearest' });
      activeIdx = idx;
    } else { activeIdx = -1; }
  }

  function selectOption(item) {
    input.value = item.value;
    closeDropdown();
    renderCards();
  }

  function buildSuggestions(q) {
    if (!q || q.length < 1) return [];
    const ql = q.toLowerCase();
    const results = [];

    // Contact names
    allContacts.forEach(c => {
      if (c.name.toLowerCase().includes(ql)) {
        results.push({ type: 'contact', value: c.name, main: c.name,
          sub: c.categories.join(', ') || 'Contact' });
      }
    });

    // Categories
    CONTACT_CATEGORIES.forEach(cat => {
      if (cat.toLowerCase().includes(ql)) {
        results.push({ type: 'category', value: cat, main: cat, sub: 'Category' });
      }
    });

    // Airports
    Airports.search(q, 4).forEach(ap => {
      results.push({ type: 'airport', value: ap.icao,
        main: `${ap.icao} — ${ap.name}`, sub: `${ap.city}, ${ap.state}` });
    });

    return results.slice(0, 12);
  }

  const CAT_LABEL = { contact: 'CT', category: 'CAT', airport: '&#9992;' };

  function renderDropdown(results) {
    if (!dropdown) dropdown = createDropdown();
    if (results.length === 0) { closeDropdown(); return; }
    options = results; activeIdx = -1;

    dropdown.innerHTML = results.map((item, i) => {
      const badge = `<span class="s-cat s-cat-${item.type}">${CAT_LABEL[item.type]}</span>`;
      const sub   = item.sub ? `<span class="s-sub">${esc(item.sub)}</span>` : '';
      return `<div class="search-option" data-idx="${i}">
        ${badge}
        <span class="s-main">${esc(item.main)}</span>
        ${sub}
      </div>`;
    }).join('');

    dropdown.querySelectorAll('.search-option').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        selectOption(options[parseInt(el.dataset.idx)]);
      });
    });
    dropdown.style.display = '';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 1) { closeDropdown(); return; }
    renderDropdown(buildSuggestions(q));
  });

  input.addEventListener('keydown', e => {
    if (!dropdown || dropdown.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectOption(options[activeIdx]); }
    else if (e.key === 'Escape') { closeDropdown(); }
  });

  input.addEventListener('blur', () => setTimeout(closeDropdown, 160));
}

// ── Theme Toggle ─────────────────────────────────────────────────────────────

const THEME_KEY = '122jm_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('btn-theme');
  if (theme === 'light') {
    btn.innerHTML = '&#9790;';
    btn.title = 'Switch to dark mode';
  } else {
    btn.innerHTML = '&#9728;';
    btn.title = 'Switch to light mode';
  }
  localStorage.setItem(THEME_KEY, theme);
}

// ── Event Bindings ────────────────────────────────────────────────────────────

function bindEvents() {
  // Theme
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  $('btn-theme').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
  });

  // Auth
  btnSignin.addEventListener('click',     () => Auth.signIn());
  btnSigninCard.addEventListener('click', () => Auth.signIn());
  btnSignout.addEventListener('click',    () => { Auth.signOut(); onSignedOut(); });

  // Add contact
  btnAddContact.addEventListener('click', openAddModal);

  // Refresh
  btnRefresh.addEventListener('click', loadContacts);

  // Search + filter
  $('search-input').addEventListener('input',     renderCards);
  $('filter-category').addEventListener('change', renderCards);

  // Search autosuggest
  initSearchAutocomplete();

  // Contact modal
  $('contact-modal-close').addEventListener('click',  closeContactModal);
  $('contact-modal-cancel').addEventListener('click', closeContactModal);
  contactForm.addEventListener('submit', handleFormSubmit);

  // Airport autocomplete in modal
  initAirportAutocomplete('c-airport');

  // Delete modal
  $('delete-modal-close').addEventListener('click', closeDeleteModal);
  $('delete-cancel').addEventListener('click',      closeDeleteModal);
  $('delete-confirm').addEventListener('click',     handleDeleteConfirm);

  // Config modal
  $('btn-settings').addEventListener('click',    showConfigModal);
  $('config-modal-close').addEventListener('click', closeConfigModal);
  $('config-cancel').addEventListener('click',   closeConfigModal);
  $('config-save').addEventListener('click',     saveConfig);

  // Close modals on overlay click
  [contactModal, deleteModal, configModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      [contactModal, deleteModal, configModal].forEach(m => m.style.display = 'none');
    }
  });
}

// ── Airport Autocomplete (same as app.js) ─────────────────────────────────────

function initAirportAutocomplete(inputId) {
  const input = $(inputId);
  let dropdown = null, options = [], activeIdx = -1;

  function createDropdown() {
    const el = document.createElement('div');
    el.className = 'airport-dropdown';
    el.style.display = 'none';
    input.parentElement.appendChild(el);
    return el;
  }
  function closeDropdown() {
    if (dropdown) dropdown.style.display = 'none';
    options = []; activeIdx = -1;
  }
  function setActive(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.airport-option');
    items.forEach(o => o.classList.remove('active'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('active');
      items[idx].scrollIntoView({ block: 'nearest' });
      activeIdx = idx;
    } else { activeIdx = -1; }
  }
  function selectOption(ap) {
    input.value = ap.icao;
    closeDropdown();
  }
  function renderDropdown(results) {
    if (!dropdown) dropdown = createDropdown();
    if (results.length === 0) { closeDropdown(); return; }
    options = results; activeIdx = -1;
    dropdown.innerHTML = results.map((ap, i) =>
      `<div class="airport-option" data-idx="${i}">
        <span class="ap-code">${esc(ap.icao)}</span>
        <span class="ap-detail">${esc(ap.name)} &middot; ${esc(ap.city)}, ${esc(ap.state)}</span>
      </div>`
    ).join('');
    dropdown.querySelectorAll('.airport-option').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectOption(options[parseInt(item.dataset.idx)]);
      });
    });
    dropdown.style.display = '';
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) { closeDropdown(); return; }
    renderDropdown(Airports.search(q, 8));
  });
  input.addEventListener('keydown', e => {
    if (!dropdown || dropdown.style.display === 'none') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectOption(options[activeIdx]); }
    else if (e.key === 'Escape') { closeDropdown(); }
  });
  input.addEventListener('blur', () => setTimeout(closeDropdown, 160));
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Expose for inline onclick handlers
window.openEditModal   = openEditModal;
window.openDeleteModal = openDeleteModal;

