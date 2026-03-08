/**
 * notes-app.js
 * Shared notes board: pin, read/unread, URL previews via microlink.io.
 * Read status is tracked locally in localStorage (per browser/user).
 */

// ── Constants ────────────────────────────────────────────────────────────────
const READ_KEY      = '122jm_read_notes';
const AUTHOR_KEY    = '122jm_author';
const THEME_KEY     = '122jm_theme';
const NOTES_VIEW_KEY = '122jm_notes_view';

// ── State ────────────────────────────────────────────────────────────────────
let allNotes    = [];
let editingNote = null;
let deleteTarget = null;
let notesFilter  = 'all';   // 'all' | 'unread' | 'pinned'
let notesView    = localStorage.getItem(NOTES_VIEW_KEY) || 'list';  // 'list' | 'cards'

// ── DOM refs ─────────────────────────────────────────────────────────────────
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
  $('btn-signin').style.display   = 'none';
  $('btn-signout').style.display  = '';
  $('btn-add-note').disabled      = false;
  $('auth-prompt').style.display  = 'none';
  $('app-content').style.display  = '';
  loadNotes();
}
function onSignedOut() {
  $('btn-signin').style.display   = '';
  $('btn-signout').style.display  = 'none';
  $('btn-add-note').disabled      = true;
  $('auth-prompt').style.display  = '';
  $('app-content').style.display  = 'none';
  allNotes = [];
}

// ── Read status (localStorage) ───────────────────────────────────────────────
function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY)) || []); }
  catch { return new Set(); }
}
function saveReadIds(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}
function isRead(noteId)    { return getReadIds().has(noteId); }
function markRead(noteId)  { const s = getReadIds(); s.add(noteId);    saveReadIds(s); }
function markUnread(noteId){ const s = getReadIds(); s.delete(noteId); saveReadIds(s); }

// ── Data ─────────────────────────────────────────────────────────────────────
async function loadNotes() {
  $('notes-loading').style.display = '';
  $('notes-empty').style.display   = 'none';
  $('notes-grid').innerHTML        = '';
  try {
    allNotes = await Sheets.fetchAllNotes();
    renderNotes();
  } catch (err) {
    $('notes-empty').textContent    = `Error: ${err.message}`;
    $('notes-empty').style.display  = '';
  } finally {
    $('notes-loading').style.display = 'none';
  }
}

// ── Render ───────────────────────────────────────────────────────────────────
function getFiltered() {
  if (notesFilter === 'unread') return allNotes.filter(n => !isRead(n.id));
  if (notesFilter === 'pinned') return allNotes.filter(n => n.pinned);
  return allNotes;
}

function getSorted(notes) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return (b.created || '').localeCompare(a.created || '');
  });
}

function renderNotes() {
  const readIds  = getReadIds();
  const filtered = getSorted(getFiltered());
  const grid     = $('notes-grid');

  // Apply view class
  grid.className = notesView === 'list' ? 'notes-view-list' : 'notes-view-cards';

  // Update filter badges
  const totalUnread = allNotes.filter(n => !readIds.has(n.id)).length;
  $('badge-all').textContent    = totalUnread || '';
  $('badge-all').style.display  = totalUnread ? '' : 'none';
  $('badge-unread').textContent = totalUnread || '';
  $('badge-unread').style.display = totalUnread ? '' : 'none';

  if (filtered.length === 0) {
    grid.innerHTML                = '';
    $('notes-empty').style.display = '';
    $('notes-empty').textContent  = allNotes.length === 0
      ? 'No notes yet. Click "+ Add Note" to post the first one.'
      : notesFilter === 'unread' ? 'No unread notes — all caught up!'
      : 'No pinned notes.';
    return;
  }
  $('notes-empty').style.display = 'none';

  grid.innerHTML = filtered.map(n => buildNoteCard(n, readIds)).join('');

  // Async: load URL previews for each note
  filtered.forEach(n => {
    const urls = extractUrls(n.content);
    if (!urls.length) return;
    const cardEl = $('notes-grid').querySelector(`[data-note-row="${n._row}"]`);
    if (cardEl) loadUrlPreviews(cardEl, urls, n._row);
  });
}

const NOTE_PREVIEW_LINES = 3;   // lines shown before "more" button

function buildNoteCard(n, readIds) {
  const read    = readIds.has(n.id);
  const cls     = [
    'note-card',
    !read        ? 'is-unread' : '',
    n.pinned     ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');

  const lines   = (n.content || '').split('\n');
  const title   = lines[0] || '(untitled)';
  const body    = lines.slice(1).join('\n').trim();

  const pinIcon = n.pinned ? '&#9733;' : '&#9734;';  // filled / outline star
  const pinCls  = n.pinned ? 'btn-pin active' : 'btn-pin';
  const readLbl = read ? 'Mark Unread' : 'Mark Read';

  const urls       = extractUrls(n.content);
  const urlHtml = urls.length
    ? `<div class="url-previews" id="url-prev-${n._row}">${urls.map((u, i) => buildPreviewPlaceholder(u, n._row, i)).join('')}</div>`
    : '';

  // Body: collapse to NOTE_PREVIEW_LINES if note is long
  let bodyHtml = '';
  if (body) {
    const bodyLines = body.split('\n');
    if (bodyLines.length > NOTE_PREVIEW_LINES) {
      const snippetHtml = linkify(bodyLines.slice(0, NOTE_PREVIEW_LINES).join('\n'));
      const fullHtml    = linkify(body);
      bodyHtml = `
      <div class="note-body"><div class="note-body-text"><span class="note-body-preview">${snippetHtml}<span class="note-body-ellipsis"> …</span></span><span class="note-body-full" style="display:none;">${fullHtml}</span></div><button class="note-expand-btn" onclick="toggleNoteBody(this)" aria-expanded="false">more</button></div>`;
    } else {
      bodyHtml = `<div class="note-body">${linkify(body)}</div>`;
    }
  }

  return `
    <div class="${cls}" data-note-row="${n._row}">
      <div class="note-card-top">
        <div class="note-title">${linkify(title)}</div>
        <div class="note-card-btns">
          <button class="${pinCls}" title="${n.pinned ? 'Unpin' : 'Pin'}"
                  onclick="togglePin(${n._row})">${pinIcon}</button>
          <button class="btn-icon" title="Edit"   onclick="openEditModal(${n._row})">&#9998;</button>
          <button class="btn-icon danger" title="Delete" onclick="openDeleteModal(${n._row})">&#10005;</button>
        </div>
      </div>
      ${bodyHtml}
      ${urlHtml}
      <div class="note-meta">
        <span class="note-byline">${esc(n.author || 'Anonymous')} &middot; ${formatDateTime(n.created)}</span>
        <button class="note-read-btn" onclick="toggleRead('${esc(n.id)}', ${n._row})">${readLbl}</button>
      </div>
    </div>`;
}

// ── URL Preview ───────────────────────────────────────────────────────────────
function extractUrls(text) {
  return [...new Set((text || '').match(/https?:\/\/[^\s]+/g) || [])].slice(0, 3);
}

function buildPreviewPlaceholder(url, noteRow, idx) {
  let domain = url;
  try { domain = new URL(url).hostname; } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?sz=16&domain=${encodeURIComponent(domain)}`;
  return `
    <a class="url-preview" href="${esc(url)}" target="_blank" rel="noopener noreferrer"
       data-preview-idx="${idx}" id="upv-${noteRow}-${idx}">
      <img class="url-fav" src="${faviconUrl}" alt="" onerror="this.style.display='none'" />
      <div class="url-preview-body">
        <div class="url-domain">${esc(domain)}</div>
        <div class="url-title" id="uptitle-${noteRow}-${idx}" style="color:var(--text3);font-style:italic;">Loading&hellip;</div>
      </div>
    </a>`;
}

async function loadUrlPreviews(cardEl, urls, noteRow) {
  for (let i = 0; i < urls.length; i++) {
    const url     = urls[i];
    const titleEl = document.getElementById(`uptitle-${noteRow}-${i}`);
    const cardDiv = document.getElementById(`upv-${noteRow}-${i}`);
    if (!titleEl || !cardDiv) continue;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res  = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (data.status === 'success') {
        titleEl.textContent   = data.data.title || url;
        titleEl.style.cssText = '';

        if (data.data.description) {
          const desc = document.createElement('div');
          desc.className   = 'url-desc';
          desc.textContent = data.data.description;
          titleEl.after(desc);
        }
        if (data.data.image?.url) {
          const thumb = document.createElement('img');
          thumb.className = 'url-thumb';
          thumb.src       = data.data.image.url;
          thumb.alt       = '';
          thumb.onerror   = () => thumb.remove();
          cardDiv.appendChild(thumb);
        }
      } else {
        titleEl.textContent   = url;
        titleEl.style.cssText = '';
      }
    } catch {
      if (titleEl) { titleEl.textContent = url; titleEl.style.cssText = ''; }
    }
  }
}

// ── Linkify ───────────────────────────────────────────────────────────────────
/**
 * Splits text on URLs, escapes non-URL parts, wraps URLs in <a> tags.
 * Produces safe HTML with clickable links.
 */
function linkify(text) {
  return (text || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
    if (i % 2 === 1) {
      // URL segment
      return `<a href="${esc(part)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>`;
    }
    return esc(part);
  }).join('');
}

// ── Pin / Read toggle ─────────────────────────────────────────────────────────
async function togglePin(sheetRow) {
  const n = allNotes.find(x => x._row === sheetRow);
  if (!n) return;
  const updated = { ...n, pinned: !n.pinned };
  try {
    await Sheets.updateNote(updated);
    const idx = allNotes.findIndex(x => x._row === sheetRow);
    if (idx !== -1) allNotes[idx] = updated;
    renderNotes();
  } catch (err) {
    alert('Could not update note: ' + err.message);
  }
}

function toggleRead(noteId, sheetRow) {
  if (isRead(noteId)) markUnread(noteId);
  else                markRead(noteId);
  renderNotes();
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openAddModal() {
  editingNote = null;
  $('note-modal-title').textContent   = 'Add Note';
  $('note-modal-submit').textContent  = 'Post Note';
  $('n-content').value  = '';
  $('n-author').value   = localStorage.getItem(AUTHOR_KEY) || '';
  hideNoteError();
  $('note-modal').style.display = 'flex';
  $('n-content').focus();
}

function openEditModal(sheetRow) {
  const n = allNotes.find(x => x._row === sheetRow);
  if (!n) return;
  editingNote = n;

  $('note-modal-title').textContent   = 'Edit Note';
  $('note-modal-submit').textContent  = 'Update Note';
  $('n-content').value  = n.content;
  $('n-author').value   = n.author || '';
  hideNoteError();
  $('note-modal').style.display = 'flex';
  $('n-content').focus();
}

function closeNoteModal() {
  $('note-modal').style.display = 'none';
  editingNote = null;
}

async function handleNoteSubmit(e) {
  e.preventDefault();
  hideNoteError();

  const content = $('n-content').value.trim();
  const author  = $('n-author').value.trim();

  if (!content) return showNoteError('Note content is required.');

  // Save author name for next time
  if (author) localStorage.setItem(AUTHOR_KEY, author);

  const note = {
    ...(editingNote || {}),
    id:      editingNote?.id || String(Date.now()),
    author,
    content,
    pinned:  editingNote?.pinned || false,
    created: editingNote?.created || new Date().toISOString(),
  };

  $('note-modal-submit').disabled    = true;
  $('note-modal-submit').textContent = editingNote ? 'Saving…' : 'Posting…';

  try {
    if (editingNote) {
      await Sheets.updateNote(note);
      const idx = allNotes.findIndex(x => x._row === note._row);
      if (idx !== -1) allNotes[idx] = note;
    } else {
      await Sheets.appendNote(note);
      allNotes = await Sheets.fetchAllNotes();
    }
    closeNoteModal();
    renderNotes();
  } catch (err) {
    showNoteError(err.message);
  } finally {
    $('note-modal-submit').disabled    = false;
    $('note-modal-submit').textContent = editingNote ? 'Update Note' : 'Post Note';
  }
}

function showNoteError(msg) { $('note-form-error').textContent = msg; $('note-form-error').style.display = ''; }
function hideNoteError()    { $('note-form-error').style.display = 'none'; }

function openDeleteModal(sheetRow) {
  const n = allNotes.find(x => x._row === sheetRow);
  if (!n) return;
  deleteTarget = n;
  const title = (n.content || '').split('\n')[0];
  $('delete-modal-body').textContent = `Delete "${title}"? This cannot be undone.`;
  $('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  $('delete-modal').style.display = 'none';
  deleteTarget = null;
}

async function handleDeleteConfirm() {
  if (!deleteTarget) return;
  const btn = $('delete-confirm');
  btn.disabled = true; btn.textContent = 'Deleting…';
  try {
    await Sheets.deleteNote(deleteTarget);
    allNotes = await Sheets.fetchAllNotes();
    closeDeleteModal();
    renderNotes();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
  }
}

// ── Config Modal ──────────────────────────────────────────────────────────────
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

// ── View toggle (list / cards) ─────────────────────────────────────────────────
function setNotesViewBtn(view) {
  const btn = $('btn-notes-view');
  if (view === 'list') {
    btn.innerHTML = '&#8862; Cards';   // → "switch TO cards"
    btn.title     = 'Switch to card view';
  } else {
    btn.innerHTML = '&#8801; List';    // → "switch TO list"
    btn.title     = 'Switch to list view';
  }
}

function applyNotesView(view) {
  notesView = view;
  localStorage.setItem(NOTES_VIEW_KEY, view);
  setNotesViewBtn(view);
  renderNotes();
}

// ── Theme ─────────────────────────────────────────────────────────────────────
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

  // View toggle — initialize label then wire click
  setNotesViewBtn(notesView);
  $('btn-notes-view').addEventListener('click', () =>
    applyNotesView(notesView === 'list' ? 'cards' : 'list'));

  $('btn-signin').addEventListener('click',     () => Auth.signIn());
  $('btn-signin-card').addEventListener('click',() => Auth.signIn());
  $('btn-signout').addEventListener('click',    () => { Auth.signOut(); onSignedOut(); });
  $('btn-add-note').addEventListener('click',   openAddModal);
  $('btn-refresh').addEventListener('click',    loadNotes);

  // Filter buttons
  document.querySelectorAll('.note-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.note-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      notesFilter = btn.dataset.filter;
      renderNotes();
    });
  });

  // Author name — save on change
  const authorInput = $('notes-author');
  authorInput.value = localStorage.getItem(AUTHOR_KEY) || '';
  authorInput.addEventListener('change', () => {
    localStorage.setItem(AUTHOR_KEY, authorInput.value.trim());
  });

  // Note modal
  $('note-modal-close').addEventListener('click',   closeNoteModal);
  $('note-modal-cancel').addEventListener('click',  closeNoteModal);
  $('note-form').addEventListener('submit',         handleNoteSubmit);

  // Delete modal
  $('delete-modal-close').addEventListener('click', closeDeleteModal);
  $('delete-cancel').addEventListener('click',      closeDeleteModal);
  $('delete-confirm').addEventListener('click',     handleDeleteConfirm);

  // Config modal
  $('btn-settings').addEventListener('click',       showConfigModal);
  $('config-modal-close').addEventListener('click', closeConfigModal);
  $('config-cancel').addEventListener('click',      closeConfigModal);
  $('config-save').addEventListener('click',        saveConfig);

  [$('note-modal'), $('delete-modal'), $('config-modal')].forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      [$('note-modal'), $('delete-modal'), $('config-modal')].forEach(m => m.style.display = 'none');
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${time}`;
  } catch { return iso; }
}

// Expose for inline onclick handlers
window.openEditModal   = openEditModal;
window.openDeleteModal = openDeleteModal;
window.togglePin       = togglePin;
window.toggleRead      = toggleRead;

/** Expand / collapse a long note body in-place (no re-render). */
window.toggleNoteBody = function(btn) {
  const noteBody = btn.closest('.note-body');
  const preview  = noteBody.querySelector('.note-body-preview');
  const full     = noteBody.querySelector('.note-body-full');
  const expanded = btn.getAttribute('aria-expanded') === 'true';

  if (expanded) {
    // Collapse back to preview
    preview.style.display = '';
    full.style.display    = 'none';
    btn.textContent       = 'more';
    btn.setAttribute('aria-expanded', 'false');
  } else {
    // Expand to full text
    preview.style.display = 'none';
    full.style.display    = '';
    btn.textContent       = 'less';
    btn.setAttribute('aria-expanded', 'true');
  }
};
