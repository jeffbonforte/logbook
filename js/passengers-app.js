/**
 * passengers-app.js
 * Passenger directory with per-partner grouping and weight calculator.
 */

// ── State ───────────────────────────────────────────────────────────────────
let allPassengers  = [];
let editingPax     = null;
let deleteTarget   = null;
const selectedRows = new Set();   // _row numbers of checked passengers

// ── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Bootstrap ────────────────────────────────────────────────────────────────
window.onGISLoad = function () {
  Auth.init(onSignedIn, onSignedOut);
  if (Config.isConfigured()) Auth.signIn();
};

function initGIS() {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true; s.defer = true;
  s.onload = window.onGISLoad;
  document.head.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (Config.isConfigured()) initGIS();
  else setTimeout(() => showConfigModal(), 300);
});

// ── Auth ─────────────────────────────────────────────────────────────────────
function onSignedIn() {
  $('btn-signin').style.display  = 'none';
  $('btn-signout').style.display = '';
  $('btn-add-pax').disabled      = false;
  $('auth-prompt').style.display = 'none';
  $('app-content').style.display = '';
  loadPassengers();
}
function onSignedOut() {
  $('btn-signin').style.display  = '';
  $('btn-signout').style.display = 'none';
  $('btn-add-pax').disabled      = true;
  $('auth-prompt').style.display = '';
  $('app-content').style.display = 'none';
  allPassengers = [];
}

// ── Data ─────────────────────────────────────────────────────────────────────
async function loadPassengers() {
  $('pax-loading').style.display = '';
  $('pax-empty').style.display   = 'none';
  $('pax-sections').innerHTML    = '';
  try {
    allPassengers = await Sheets.fetchAllPassengers();
    renderSections();
  } catch (err) {
    $('pax-empty').textContent    = `Error: ${err.message}`;
    $('pax-empty').style.display  = '';
  } finally {
    $('pax-loading').style.display = 'none';
  }
}

// ── Rendering ────────────────────────────────────────────────────────────────
const PARTNER_ORDER = ['Quake', 'Ashley', 'Appenzeller', 'Bonforte'];

function getFilteredBySearch() {
  const q = ($('pax-search').value || '').trim().toLowerCase();
  if (!q) return allPassengers;
  return allPassengers.filter(p =>
    [p.name, p.email, p.partner, operatorName(p.partner)].join(' ').toLowerCase().includes(q)
  );
}

function renderSections() {
  const passengers = getFilteredBySearch();
  const total      = passengers.length;
  $('pax-count').textContent = `${total} of ${allPassengers.length} passenger${allPassengers.length !== 1 ? 's' : ''}`;

  // Group by partner — keep CURRENT_PARTNERS order, then any others
  const byPartner = {};
  passengers.forEach(p => {
    const k = p.partner || 'Other';
    if (!byPartner[k]) byPartner[k] = [];
    byPartner[k].push(p);
  });

  const allKeys = [
    ...PARTNER_ORDER.filter(k => byPartner[k]),
    ...Object.keys(byPartner).filter(k => !PARTNER_ORDER.includes(k)),
  ];

  if (allKeys.length === 0) {
    $('pax-sections').innerHTML  = '';
    $('pax-empty').style.display = '';
    $('pax-empty').textContent   = allPassengers.length === 0
      ? 'No passengers yet. Click "+ Add Passenger" to add the first entry.'
      : 'No passengers match your search.';
    return;
  }
  $('pax-empty').style.display = 'none';

  $('pax-sections').innerHTML = allKeys.map(key => {
    const paxList = byPartner[key];
    const pName   = operatorName(key);
    const pClass  = operatorClass(key);
    const isOpen  = true;   // default all open

    const rows = paxList.map(p => {
      const age   = p.dob ? calcAge(p.dob) : null;
      const dobDisp = p.dob ? `${formatDob(p.dob)}${age !== null ? ` (${age})` : ''}` : '—';
      const checked = selectedRows.has(p._row) ? 'checked' : '';
      const selCls  = selectedRows.has(p._row) ? 'selected' : '';
      return `
        <div class="pax-row ${selCls}" data-row="${p._row}">
          <input type="checkbox" class="pax-checkbox" data-row="${p._row}" ${checked} />
          <span class="pax-name">${esc(p.name)}</span>
          <span class="pax-weight">${p.weight > 0 ? p.weight + ' lbs' : '—'}</span>
          <span class="pax-dob">${dobDisp}</span>
          <span class="pax-email">${p.email ? `<a href="mailto:${esc(p.email)}" style="color:var(--primary-h);text-decoration:none;">${esc(p.email)}</a>` : '—'}</span>
          <span class="pax-actions">
            <button class="btn-icon" title="Edit"   onclick="openEditModal(${p._row})">&#9998;</button>
            <button class="btn-icon danger" title="Remove" onclick="openDeleteModal(${p._row})">&#10005;</button>
          </span>
        </div>`;
    }).join('');

    return `
      <div class="pax-section">
        <div class="pax-section-header open" data-partner="${esc(key)}" onclick="toggleSection(this)">
          <span class="pax-section-title">
            <span class="partner-badge ${pClass} pax-partner-badge">${esc(pName)}</span>
            <span class="pax-count">${paxList.length} passenger${paxList.length !== 1 ? 's' : ''}</span>
          </span>
          <span style="display:flex;align-items:center;gap:10px;">
            <button class="btn btn-ghost btn-sm pax-section-add"
                    onclick="event.stopPropagation();openAddModalForPartner('${esc(key)}')">+ Add</button>
            <span class="pax-section-arrow">&#9654;</span>
          </span>
        </div>
        <div class="pax-rows open">
          <div class="pax-col-headers">
            <span></span>
            <span>Name</span>
            <span>Weight</span>
            <span>Date of Birth</span>
            <span>Email</span>
            <span></span>
          </div>
          ${rows}
        </div>
      </div>`;
  }).join('');

  // Attach checkbox listeners after render
  document.querySelectorAll('.pax-checkbox').forEach(cb => {
    cb.addEventListener('change', onCheckboxChange);
  });
}

function toggleSection(header) {
  header.classList.toggle('open');
  const rows = header.nextElementSibling;
  rows.classList.toggle('open');
}

// ── Weight Calculator ────────────────────────────────────────────────────────
function onCheckboxChange(e) {
  const row = parseInt(e.target.dataset.row);
  if (e.target.checked) selectedRows.add(row);
  else                  selectedRows.delete(row);

  // Update row highlight
  const rowEl = e.target.closest('.pax-row');
  if (rowEl) rowEl.classList.toggle('selected', e.target.checked);

  updateWeightBar();
}

function updateWeightBar() {
  const bar  = $('weight-bar');
  const main = $('app-main');

  if (selectedRows.size === 0) {
    bar.classList.remove('visible');
    main.style.paddingBottom = '';
    return;
  }

  bar.classList.add('visible');
  main.style.paddingBottom = '130px';

  const selected = allPassengers.filter(p => selectedRows.has(p._row));
  const total    = selected.reduce((s, p) => s + (p.weight || 0), 0);

  // Chips
  $('weight-chips').innerHTML = selected.map(p =>
    `<span class="weight-chip">${esc(p.name)}${p.weight ? ` (${p.weight})` : ''}</span>`
  ).join('');

  $('weight-total').textContent = total;

  // Copyable text
  const paxStr = selected.map(p => `${p.name} (${p.weight || 0} lbs)`).join(', ');
  $('weight-copy-text').value = `Pax: ${paxStr} — Total pax weight: ${total} lbs`;
}

function clearSelection() {
  selectedRows.clear();
  document.querySelectorAll('.pax-checkbox').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('.pax-row').forEach(r => r.classList.remove('selected'));
  updateWeightBar();
}

function copyWeightText() {
  const input = $('weight-copy-text');
  input.select();
  try {
    navigator.clipboard.writeText(input.value).catch(() => document.execCommand('copy'));
  } catch {
    document.execCommand('copy');
  }
  const btn = $('weight-copy-btn');
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
}

// ── Modals ───────────────────────────────────────────────────────────────────
function openAddModal() { openAddModalForPartner(''); }

function openAddModalForPartner(partnerKey) {
  editingPax = null;
  $('pax-modal-title').textContent   = 'Add Passenger';
  $('pax-modal-submit').textContent  = 'Save';
  $('pax-form').reset();
  if (partnerKey) $('p-partner').value = partnerKey;
  hidePaxError();
  $('pax-modal').style.display = 'flex';
  $('p-name').focus();
}

function openEditModal(sheetRow) {
  const p = allPassengers.find(x => x._row === sheetRow);
  if (!p) return;
  editingPax = p;

  $('pax-modal-title').textContent   = `Edit — ${p.name}`;
  $('pax-modal-submit').textContent  = 'Update';
  hidePaxError();

  $('p-partner').value = p.partner;
  $('p-name').value    = p.name;
  $('p-weight').value  = p.weight || '';
  $('p-dob').value     = p.dob   || '';
  $('p-email').value   = p.email || '';

  $('pax-modal').style.display = 'flex';
  $('p-name').focus();
}

function closePaxModal() {
  $('pax-modal').style.display = 'none';
  editingPax = null;
}

async function handlePaxSubmit(e) {
  e.preventDefault();
  hidePaxError();

  const partner = $('p-partner').value;
  const name    = $('p-name').value.trim();
  const weight  = parseFloat($('p-weight').value) || 0;

  if (!partner) return showPaxError('Please select a partner.');
  if (!name)    return showPaxError('Name is required.');
  if (!weight)  return showPaxError('Weight is required.');

  const pax = {
    ...(editingPax || {}),
    partner,
    name,
    weight,
    dob:   $('p-dob').value   || '',
    email: $('p-email').value.trim() || '',
  };

  $('pax-modal-submit').disabled    = true;
  $('pax-modal-submit').textContent = editingPax ? 'Saving…' : 'Adding…';

  try {
    if (editingPax) {
      await Sheets.updatePassenger(pax);
      const idx = allPassengers.findIndex(x => x._row === pax._row);
      if (idx !== -1) allPassengers[idx] = pax;
    } else {
      await Sheets.appendPassenger(pax);
      allPassengers = await Sheets.fetchAllPassengers();
    }
    closePaxModal();
    renderSections();
    updateWeightBar();
  } catch (err) {
    showPaxError(err.message);
  } finally {
    $('pax-modal-submit').disabled    = false;
    $('pax-modal-submit').textContent = editingPax ? 'Update' : 'Save';
  }
}

function showPaxError(msg) { $('pax-form-error').textContent = msg; $('pax-form-error').style.display = ''; }
function hidePaxError()    { $('pax-form-error').style.display = 'none'; }

function openDeleteModal(sheetRow) {
  const p = allPassengers.find(x => x._row === sheetRow);
  if (!p) return;
  deleteTarget = p;
  $('delete-modal-body').textContent = `Remove "${p.name}" from the passenger list? This cannot be undone.`;
  $('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  $('delete-modal').style.display = 'none';
  deleteTarget = null;
}

async function handleDeleteConfirm() {
  if (!deleteTarget) return;
  const btn = $('delete-confirm');
  btn.disabled = true; btn.textContent = 'Removing…';
  try {
    await Sheets.deletePassenger(deleteTarget);
    selectedRows.delete(deleteTarget._row);
    allPassengers = await Sheets.fetchAllPassengers();
    closeDeleteModal();
    renderSections();
    updateWeightBar();
  } catch (err) {
    alert('Remove failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Remove';
  }
}

// ── Config Modal ─────────────────────────────────────────────────────────────
function showConfigModal() {
  const cfg = Config.load();
  $('cfg-client-id').value = cfg.clientId || '';
  $('cfg-sheet-id').value  = cfg.sheetId  || '';
  $('config-error').style.display = 'none';
  $('config-modal').style.display = 'flex';
}
function closeConfigModal() { $('config-modal').style.display = 'none'; }
function saveConfig() {
  const clientId = $('cfg-client-id').value.trim();
  const sheetId  = $('cfg-sheet-id').value.trim();
  if (!clientId || !sheetId) {
    $('config-error').textContent   = 'Both fields are required.';
    $('config-error').style.display = '';
    return;
  }
  Config.set({ clientId, sheetId });
  closeConfigModal();
  initGIS();
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const THEME_KEY = '122jm_theme';
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = $('btn-theme');
  btn.innerHTML = t === 'light' ? '&#9790;' : '&#9728;';
  btn.title     = t === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
  localStorage.setItem(THEME_KEY, t);
}

// ── Event Bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  $('btn-theme').addEventListener('click', () =>
    applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'));

  $('btn-signin').addEventListener('click',     () => Auth.signIn());
  $('btn-signin-card').addEventListener('click',() => Auth.signIn());
  $('btn-signout').addEventListener('click',    () => { Auth.signOut(); onSignedOut(); });
  $('btn-add-pax').addEventListener('click',    openAddModal);
  $('btn-refresh').addEventListener('click',    loadPassengers);
  $('pax-search').addEventListener('input',     renderSections);

  // Weight bar
  $('weight-clear').addEventListener('click',    clearSelection);
  $('weight-copy-btn').addEventListener('click', copyWeightText);

  // Pax modal
  $('pax-modal-close').addEventListener('click',   closePaxModal);
  $('pax-modal-cancel').addEventListener('click',  closePaxModal);
  $('pax-form').addEventListener('submit',         handlePaxSubmit);

  // Delete modal
  $('delete-modal-close').addEventListener('click', closeDeleteModal);
  $('delete-cancel').addEventListener('click',      closeDeleteModal);
  $('delete-confirm').addEventListener('click',     handleDeleteConfirm);

  // Config modal
  $('btn-settings').addEventListener('click',       showConfigModal);
  $('config-modal-close').addEventListener('click', closeConfigModal);
  $('config-cancel').addEventListener('click',      closeConfigModal);
  $('config-save').addEventListener('click',        saveConfig);

  [$('pax-modal'), $('delete-modal'), $('config-modal')].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      [$('pax-modal'), $('delete-modal'), $('config-modal')].forEach(m => m.style.display = 'none');
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function calcAge(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

function formatDob(dob) {
  if (!dob) return '';
  const [y, m, d] = dob.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

// Expose for inline onclick handlers
window.openEditModal          = openEditModal;
window.openDeleteModal        = openDeleteModal;
window.toggleSection          = toggleSection;
window.openAddModalForPartner = openAddModalForPartner;
