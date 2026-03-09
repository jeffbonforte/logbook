/**
 * range-lookup.js
 * Airport range lookup — PC-12-capable airports within 1,600 nm of KPAO.
 * Data is loaded from js/airports-data.js (RANGE_AIRPORTS array).
 */

const RL_MAX_ROWS = 200;

// ── Airport notes (Google Sheets-backed, in-memory cache) ────────────────────
let _apNotesCache = {};      // { CODE: { note, author, updated } }
let _apNotesCacheLoaded = false;

async function loadAirportNotesCache() {
  try {
    const rows = await Sheets.fetchAllAirportNotes();
    _apNotesCache = {};
    rows.forEach(r => { _apNotesCache[r.code] = r; });
    _apNotesCacheLoaded = true;
  } catch (e) {
    console.warn('Could not load airport notes:', e);
  }
}

function getCachedAirportNote(code) {
  const entry = _apNotesCache[code.toUpperCase()];
  return entry ? entry.note : '';
}

function getCachedAirportNoteAuthor(code) {
  const entry = _apNotesCache[code.toUpperCase()];
  return entry ? entry.author : '';
}

async function saveAirportNote(code, text) {
  const upperCode = code.toUpperCase();
  // Get current user email for author attribution
  let author = '';
  try {
    const token = await Auth.ensureToken();
    const res   = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) { const info = await res.json(); author = info.email || ''; }
  } catch { /* ignore — author will be blank */ }

  await Sheets.upsertAirportNote({ code: upperCode, author, note: text });
  // Update local cache
  _apNotesCache[upperCode] = { code: upperCode, author, note: text, updated: new Date().toISOString() };
}

// ── State ─────────────────────────────────────────────────────────────────────
let rlQuery      = '';
let rlDetailCode = null;   // null = list view; airport code string = detail view

// ── Open / Close ──────────────────────────────────────────────────────────────
function openRangeLookup() {
  rlQuery      = '';
  rlDetailCode = null;
  $('range-search').value = '';
  renderRange();
  $('range-modal').style.display = 'flex';
  setTimeout(() => $('range-search').focus(), 50);
  // Load airport notes from Sheets (background, non-blocking)
  if (!_apNotesCacheLoaded) loadAirportNotesCache();
}

function closeRangeLookup() {
  $('range-modal').style.display = 'none';
}

// ── View router ───────────────────────────────────────────────────────────────
function renderRange() {
  if (rlDetailCode) {
    $('range-list-view').style.display   = 'none';
    $('range-detail-view').style.display = '';
    renderRangeDetail(rlDetailCode);
  } else {
    $('range-list-view').style.display   = '';
    $('range-detail-view').style.display = 'none';
    renderRangeList();
  }
}

// ── List view ─────────────────────────────────────────────────────────────────
function getFilteredAirports() {
  if (!rlQuery) return RANGE_AIRPORTS;
  const q = rlQuery.toLowerCase();
  return RANGE_AIRPORTS.filter(ap =>
    ap.code.toLowerCase().includes(q) ||
    ap.name.toLowerCase().includes(q) ||
    ap.city.toLowerCase().includes(q) ||
    ap.state.toLowerCase().includes(q) ||
    ap.nearby.some(n => n.toLowerCase().includes(q))
  );
}

function renderRangeList() {
  const filtered = getFilteredAirports();
  const shown    = filtered.slice(0, RL_MAX_ROWS);
  const more     = filtered.length - shown.length;

  // Count label
  const countEl = $('range-count');
  if (filtered.length === RANGE_AIRPORTS.length) {
    countEl.textContent = `${RANGE_AIRPORTS.length.toLocaleString()} airports`;
  } else {
    countEl.textContent = `${filtered.length.toLocaleString()} of ${RANGE_AIRPORTS.length.toLocaleString()}`;
  }

  if (filtered.length === 0) {
    $('range-tbody').innerHTML = `
      <tr><td colspan="5" class="rl-empty-row">No airports match your search.</td></tr>`;
    $('range-more').style.display = 'none';
    return;
  }

  $('range-tbody').innerHTML = shown.map(buildRangeRow).join('');

  if (more > 0) {
    $('range-more').textContent   = `Showing first ${RL_MAX_ROWS} — search to narrow results`;
    $('range-more').style.display = '';
  } else {
    $('range-more').style.display = 'none';
  }
}

function apLoc(ap) {
  if (!ap.city) return ap.country || '';
  if (ap.country === 'US') return ap.state ? `${ap.city}, ${ap.state}` : ap.city;
  return ap.state ? `${ap.city}, ${ap.country}` : ap.city;
}

function buildRangeRow(ap) {
  const rwyStr = ap.rwy ? ap.rwy.toLocaleString() : '—';
  return `
    <tr class="rl-row" data-rl-code="${esc(ap.code)}">
      <td><span class="rl-code-chip">${esc(ap.code)}</span></td>
      <td class="rl-name-cell">${esc(ap.name)}</td>
      <td class="rl-city-cell">${esc(apLoc(ap))}</td>
      <td class="num">${ap.dist ?? '—'}</td>
      <td class="num rl-rwy-cell">${rwyStr}</td>
    </tr>`;
}

// ── Detail view ───────────────────────────────────────────────────────────────
function renderRangeDetail(code) {
  const ap = RANGE_AIRPORTS.find(a => a.code === code);
  if (!ap) { rlDetailCode = null; renderRange(); return; }

  const loc    = apLoc(ap);
  const rwyFmt = ap.rwy ? ap.rwy.toLocaleString() + ' ft' : 'Unknown';

  const nearbyHtml = ap.nearby.length
    ? ap.nearby.map(n => `<span class="rl-nearby-chip">${esc(n)}</span>`).join('')
    : '<span class="rl-no-nearby">No nearby city data</span>';

  $('range-detail-view').innerHTML = `
    <div class="rl-detail-topbar">
      <button class="btn btn-ghost btn-sm" id="rl-back-btn">← Back</button>
      <button class="btn btn-secondary btn-sm" data-copy-code="${esc(ap.code)}" id="rl-copy-btn">
        ⎘ Copy ${esc(ap.code)}
      </button>
    </div>

    <div class="rl-detail-card">
      <div class="rl-detail-hero">
        <div class="rl-detail-code-badge">${esc(ap.code)}</div>
        <div class="rl-detail-hero-text">
          <h2 class="rl-detail-airport-name">${esc(ap.name)}</h2>
          ${loc ? `<p class="rl-detail-location">${esc(loc)}</p>` : ''}
          <div class="rl-detail-links">
            <a class="rl-ext-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ap.name + ' ' + (ap.city || '') + ' ' + (ap.state || ap.country || ''))}" target="_blank" rel="noopener">View on Google Maps &#8599;</a>
          </div>
        </div>
      </div>

      <div class="rl-detail-stats">
        <div class="rl-stat">
          <span class="rl-stat-label">Distance from KPAO</span>
          <span class="rl-stat-value">${ap.dist ?? '—'} nm</span>
        </div>
        <div class="rl-stat">
          <span class="rl-stat-label">Runway Length</span>
          <span class="rl-stat-value">${rwyFmt}</span>
        </div>
        <div class="rl-stat">
          <span class="rl-stat-label">Country</span>
          <span class="rl-stat-value">${esc(ap.country || '—')}</span>
        </div>
      </div>

      <div class="rl-detail-section">
        <h3 class="rl-section-label">Nearby Cities</h3>
        <div class="rl-nearby-chips">${nearbyHtml}</div>
      </div>

      <div class="rl-detail-section">
        <h3 class="rl-section-label">Partner Notes</h3>
        <textarea class="rl-notes-textarea" id="rl-notes-input"
                  placeholder="Add notes about FBOs, fees, tips…"
                  rows="3">${esc(getCachedAirportNote(ap.code))}</textarea>
        <span class="rl-notes-status" id="rl-notes-status"></span>
      </div>
    </div>
  `;

  $('rl-back-btn').addEventListener('click', () => { rlDetailCode = null; renderRange(); });
  $('rl-copy-btn').addEventListener('click',  e => copyAirportCode(ap.code, e.currentTarget));

  // Auto-save notes to Google Sheets on input (debounced)
  let noteTimer = null;
  const notesInput  = $('rl-notes-input');
  const notesStatus = $('rl-notes-status');
  notesInput.addEventListener('input', () => {
    clearTimeout(noteTimer);
    notesStatus.textContent = '';
    notesStatus.className   = 'rl-notes-status';
    noteTimer = setTimeout(async () => {
      notesStatus.textContent = 'Saving…';
      notesStatus.className   = 'rl-notes-status rl-notes-saving';
      try {
        await saveAirportNote(ap.code, notesInput.value);
        notesStatus.textContent = 'Saved';
        notesStatus.className   = 'rl-notes-status rl-notes-saved visible';
        setTimeout(() => { notesStatus.textContent = ''; notesStatus.className = 'rl-notes-status'; }, 2000);
      } catch (e) {
        console.error('Failed to save airport note:', e);
        notesStatus.textContent = 'Save failed — try again';
        notesStatus.className   = 'rl-notes-status rl-notes-error';
      }
    }, 800);
  });
}

// ── Copy helper ───────────────────────────────────────────────────────────────
function copyAirportCode(code, btn) {
  const orig = btn.innerHTML;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('rl-copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('rl-copied'); }, 1600);
  }).catch(() => {
    // Fallback for non-https
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('rl-copied');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('rl-copied'); }, 1600);
  });
}

// ── Bind events ───────────────────────────────────────────────────────────────
function bindRangeLookupEvents() {
  $('btn-range-lookup').addEventListener('click', openRangeLookup);
  $('range-modal-close').addEventListener('click', closeRangeLookup);
  $('range-modal').addEventListener('click', e => {
    if (e.target === $('range-modal')) closeRangeLookup();
  });

  $('range-search').addEventListener('input', e => {
    rlQuery      = e.target.value.trim();
    rlDetailCode = null;
    renderRangeList();
    $('range-list-view').style.display   = '';
    $('range-detail-view').style.display = 'none';
  });

  // Row click → detail; no copy buttons in the row itself
  $('range-tbody').addEventListener('click', e => {
    const row = e.target.closest('.rl-row');
    if (row) { rlDetailCode = row.dataset.rlCode; renderRange(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('range-modal').style.display !== 'none') closeRangeLookup();
  });
}
