/**
 * app.js
 * Main UI controller — table rendering, dashboard stats, modals, filters, sorting.
 */

// ── State ──────────────────────────────────────────────────────────────────
let allFlights    = [];   // full dataset from Sheets
let editingFlight = null; // flight being edited, or null for new
let deleteTarget  = null; // flight queued for deletion
let sortCol  = 'flightNum';
let sortDir  = 'asc';    // 'asc' | 'desc'
let dashRange = 'all';   // 'all' | 'ytd' | '90d' | 'custom'

// Year/month-collapse state — auto-inited on first load
const collapsedYears  = new Set();   // "YYYY"
const collapsedMonths = new Set();   // "YYYY-MM"
let   yearCollapseInited = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const authPrompt   = $('auth-prompt');
const appContent   = $('app-content');
const btnSignin    = $('btn-signin');
const btnSigninCard= $('btn-signin-card');
const btnSignout   = $('btn-signout');
const btnAddFlight = $('btn-add-flight');
const btnFab       = $('btn-fab-flight');   // mobile FAB
const btnRefresh   = $('btn-refresh');
const tableLoading = $('table-loading');
const tableEmpty   = $('table-empty');
const tbody        = $('flight-tbody');
const rowCountEl   = $('row-count');

// Dashboard
const statHobbs        = $('stat-hobbs');
const statFlights      = $('stat-flights');
const statLandings     = $('stat-landings');
const statCycles       = $('stat-cycles');
const statCurrentHobbs = $('stat-current-hobbs');
const partnerGrid      = $('partner-grid');

// Flight modal
const flightModal  = $('flight-modal');
const flightForm   = $('flight-form');
const modalTitle   = $('modal-title');
const modalSubmit  = $('modal-submit');
const formError    = $('form-error');
const hDurationHint= $('hobbs-duration-hint');

// Delete modal
const deleteModal  = $('delete-modal');
const deleteBody   = $('delete-modal-body');

// Config modal
const configModal  = $('config-modal');
const cfgClientId  = $('cfg-client-id');
const cfgSheetId   = $('cfg-sheet-id');
const cfgSheetName = $('cfg-sheet-name');
const configError  = $('config-error');

// ── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * Called by the GIS script's onload callback (injected by initGIS below).
 */
window.onGISLoad = function () {
  Auth.init(onSignedIn, onSignedOut);
  if (Config.isConfigured()) {
    // Try silent sign-in — GIS will prompt if no token cached
    Auth.signIn();
  }
};

function initGIS() {
  // Dynamically load the Google Identity Services library
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = window.onGISLoad;
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  if (Config.isConfigured()) {
    initGIS();
  }
  // If not configured, show the config modal immediately
  if (!Config.isConfigured()) {
    setTimeout(() => showConfigModal(), 300);
  }
});

// ── Auth state handlers ────────────────────────────────────────────────────

function onSignedIn() {
  btnSignin.style.display    = 'none';
  btnSignout.style.display   = '';
  btnAddFlight.disabled      = false;
  if (btnFab) btnFab.disabled = false;
  authPrompt.style.display   = 'none';
  appContent.style.display   = '';
  loadFlights();
}

function onSignedOut() {
  btnSignin.style.display    = '';
  btnSignout.style.display   = 'none';
  btnAddFlight.disabled      = true;
  if (btnFab) btnFab.disabled = true;
  authPrompt.style.display   = '';
  appContent.style.display   = 'none';
  allFlights = [];
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadFlights() {
  tableLoading.style.display = '';
  tableEmpty.style.display   = 'none';
  tbody.innerHTML             = '';
  try {
    allFlights = await Sheets.fetchAll();
    if (!yearCollapseInited) {
      initYearCollapse();
      yearCollapseInited = true;
    }
    renderTable();
    renderDashboard();
  } catch (err) {
    showTableError(err.message);
  } finally {
    tableLoading.style.display = 'none';
  }
}

/** Auto-collapse all years/months except the current ones on first data load. */
function initYearCollapse() {
  const today        = new Date();
  const currentYear  = String(today.getFullYear());
  const currentMonth = `${currentYear}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const years  = [...new Set(allFlights.map(f => (f.date || '').slice(0, 4)).filter(Boolean))];
  const months = [...new Set(allFlights.map(f => (f.date || '').slice(0, 7)).filter(Boolean))];

  years.forEach(y  => { if (y !== currentYear)  collapsedYears.add(y); });
  months.forEach(m => { if (m !== currentMonth) collapsedMonths.add(m); });
}

function showTableError(msg) {
  tableEmpty.textContent  = `Error: ${msg}`;
  tableEmpty.style.display = '';
}

// ── Dashboard ──────────────────────────────────────────────────────────────

/** Returns [fromISO, toISO] strings for the current dashRange selection, or null for all-time. */
function getDashRangeDates() {
  const today = todayISO();
  if (dashRange === 'all') return null;
  if (dashRange === 'ytd') {
    const year = today.slice(0, 4);
    return [`${year}-01-01`, today];
  }
  if (dashRange === '90d') {
    const d = new Date(); d.setDate(d.getDate() - 90);
    return [d.toISOString().slice(0, 10), today];
  }
  if (dashRange === 'custom') {
    const from = $('range-from').value;
    const to   = $('range-to').value;
    if (!from && !to) return null;
    return [from || '0000-01-01', to || today];
  }
  return null;
}

/** Filters allFlights to just those within the current dash date range. */
function getDashFlights() {
  const range = getDashRangeDates();
  if (!range) return allFlights;
  const [from, to] = range;
  return allFlights.filter(f => f.date >= from && f.date <= to);
}

/** Human-readable label for the active range. */
function getRangeLabel(flights) {
  const range = getDashRangeDates();
  if (!range) return `${flights.length} flights, all time`;
  const [from, to] = range;
  return `${flights.length} flights · ${formatDate(from)} – ${formatDate(to)}`;
}

function renderDashboard() {
  if (!allFlights.length) {
    [statHobbs, statFlights, statLandings, statCycles, statCurrentHobbs]
      .forEach(el => el.textContent = '—');
    $('stat-hobbs-period').textContent = '';
    $('range-label').textContent = '';
    partnerGrid.innerHTML = '';
    return;
  }

  // Current Hobbs always comes from the most recent flight — it's the odometer
  const sorted = [...allFlights].sort((a, b) => a.flightNum - b.flightNum);
  const last   = sorted[sorted.length - 1];
  statCurrentHobbs.textContent = last.hobbsEnd.toFixed(1);

  // All other stats use the date-filtered set
  const flights = getDashFlights();
  $('range-label').textContent = getRangeLabel(flights);

  let hobbsFlown = 0, totalLandings = 0, totalCycles = 0;
  flights.forEach(f => {
    hobbsFlown    += f.flt || 0;
    totalLandings += f.landings;
    totalCycles   += f.cycles;
  });

  statHobbs.textContent    = hobbsFlown.toFixed(1) + ' h';
  statFlights.textContent  = flights.length;
  statLandings.textContent = totalLandings;
  statCycles.textContent   = totalCycles;

  // Period sub-label under "Hours Flown"
  const periodNames = { all:'all time', ytd:'year to date', '90d':'last 90 days', custom:'custom range' };
  $('stat-hobbs-period').textContent = periodNames[dashRange] || '';

  // Partner section title
  $('partner-section-title').textContent =
    dashRange === 'all' ? 'Partner Hours — All Time' :
    dashRange === 'ytd' ? `Partner Hours — ${todayISO().slice(0,4)}` :
    dashRange === '90d' ? 'Partner Hours — Last 90 Days' : 'Partner Hours — Custom Range';

  // Per-operator breakdown (uses same date-filtered set)
  // Group by canonical display name so all raw variants of the same operator
  // (e.g. "Borbolla", "Borbolla (Up)", "Borbolla (pull)", "Borbolla (UL)") merge into one card.
  const byOp = {};
  flights.forEach(f => {
    const raw  = f.partner || 'Unknown';
    const name = operatorName(raw);    // canonical display name
    if (!byOp[name]) byOp[name] = { hobbs: 0, flights: 0, landings: 0, cycles: 0, rawKey: raw };
    byOp[name].hobbs    += f.flt || 0;
    byOp[name].flights  += 1;
    byOp[name].landings += f.landings;
    byOp[name].cycles   += f.cycles;
  });

  // Current partners first (always shown, even at 0)
  const currentCards = CURRENT_PARTNERS.map(key => {
    const displayName = operatorName(key);
    const d   = byOp[displayName] || { hobbs: 0, flights: 0, landings: 0, cycles: 0 };
    const cls = operatorClass(key);
    return `
      <div class="partner-card">
        <div class="partner-name">${esc(displayName)}</div>
        <div class="partner-stats">
          <div class="partner-stat"><strong>${d.hobbs.toFixed(1)}</strong> hrs</div>
          <div class="partner-stat"><strong>${d.flights}</strong> flights</div>
          <div class="partner-stat"><strong>${d.landings}</strong> ldgs</div>
          <div class="partner-stat"><strong>${d.cycles}</strong> cycles</div>
        </div>
      </div>`;
  }).join('');

  // Other operators seen in this period (former, shared, charter) — only if they have flights
  const currentNames = new Set(CURRENT_PARTNERS.map(k => operatorName(k)));
  const otherKeys    = Object.keys(byOp).filter(name => !currentNames.has(name));
  let otherSection = '';
  if (otherKeys.length > 0) {
    const otherCards = otherKeys.map(name => {
      const d   = byOp[name];
      const cat = operatorCategory(d.rawKey);   // use stored raw key for category lookup
      const tag = cat === 'former'  ? ' <span class="op-tag">former</span>'  :
                  cat === 'charter' ? ' <span class="op-tag">charter</span>' :
                  cat === 'shared'  ? ' <span class="op-tag">ops</span>'     : '';
      return `
        <div class="partner-card partner-card-other">
          <div class="partner-name">${esc(name)}${tag}</div>
          <div class="partner-stats">
            <div class="partner-stat"><strong>${d.hobbs.toFixed(1)}</strong> hrs</div>
            <div class="partner-stat"><strong>${d.flights}</strong> flights</div>
            <div class="partner-stat"><strong>${d.landings}</strong> ldgs</div>
            <div class="partner-stat"><strong>${d.cycles}</strong> cycles</div>
          </div>
        </div>`;
    }).join('');

    const totalOtherFlights = otherKeys.reduce((s, name) => s + byOp[name].flights, 0);
    otherSection = `
      <div class="others-toggle-row">
        <button class="others-toggle" onclick="toggleOthers(this)">
          <span class="others-toggle-arrow">▶</span>
          See Others
          <span class="others-toggle-count">${otherKeys.length} operator${otherKeys.length > 1 ? 's' : ''}, ${totalOtherFlights} flight${totalOtherFlights !== 1 ? 's' : ''}</span>
        </button>
      </div>
      <div class="others-grid" style="display:none;">
        ${otherCards}
      </div>`;
  }

  partnerGrid.innerHTML = currentCards + otherSection;
}

// ── Table ──────────────────────────────────────────────────────────────────

function getFiltered() {
  const search  = $('search-input').value.trim().toLowerCase();
  const partner = $('filter-partner').value;
  const purpose = $('filter-purpose').value;

  return allFlights.filter(f => {
    // Partner filter: match raw value OR, for Borbolla, match any variant
    if (partner) {
      const rawMatch  = f.partner === partner;
      // Group all Borbolla variants under the base 'Borbolla' filter key
      const isBorbolla = partner === 'Borbolla' && f.partner.startsWith('Borbolla');
      if (!rawMatch && !isBorbolla) return false;
    }
    if (purpose && f.purpose !== purpose) return false;
    if (search) {
      // Also expand airport codes to full names for search
      const depAp = Airports.lookup(f.departure);
      const arrAp = Airports.lookup(f.arrival);
      const depInfo = depAp ? `${depAp.name} ${depAp.city} ${depAp.state}` : '';
      const arrInfo = arrAp ? `${arrAp.name} ${arrAp.city} ${arrAp.state}` : '';
      const hay = [
        f.departure, f.arrival, depInfo, arrInfo,
        f.partner, operatorName(f.partner),
        f.pilot || '',
        f.purpose, String(f.flightNum), f.date,
      ].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function getSorted(flights) {
  return [...flights].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 :  1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function renderTable() {
  const filtered = getSorted(getFiltered());
  rowCountEl.textContent = `${filtered.length} of ${allFlights.length} flights`;

  // Update sort indicators
  document.querySelectorAll('th[data-col]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    tableEmpty.style.display = '';
    tableEmpty.textContent   = allFlights.length === 0
      ? 'No flights logged yet. Click "+ Log Flight" to add the first entry.'
      : 'No flights match your filters.';
    return;
  }
  tableEmpty.style.display = 'none';

  // Year/month headers only make sense when rows are in chronological order
  const showYearHeaders = (sortCol === 'flightNum' || sortCol === 'date');

  // Pre-compute per-year and per-month totals for the header stats
  const yearTotals  = {};
  const monthTotals = {};
  if (showYearHeaders) {
    filtered.forEach(f => {
      const y  = (f.date || '').slice(0, 4);
      const ym = (f.date || '').slice(0, 7);
      if (!y || !ym) return;
      if (!yearTotals[y])   yearTotals[y]  = { flights: 0, hours: 0 };
      if (!monthTotals[ym]) monthTotals[ym] = { flights: 0, hours: 0 };
      yearTotals[y].flights++;   yearTotals[y].hours  += f.flt || 0;
      monthTotals[ym].flights++; monthTotals[ym].hours += f.flt || 0;
    });
  }

  const rows = [];
  let lastYear = null, lastYearMonth = null;

  filtered.forEach(f => {
    const year      = (f.date || '').slice(0, 4);
    const yearMonth = (f.date || '').slice(0, 7);   // "YYYY-MM"

    // ── Year header ──
    if (showYearHeaders && year && year !== lastYear) {
      const t         = yearTotals[year] || { flights: 0, hours: 0 };
      const collapsed = collapsedYears.has(year);
      rows.push(`
        <tr class="year-header-row" data-year="${esc(year)}" onclick="toggleYearSection('${esc(year)}')">
          <td colspan="13">
            <div class="year-header-inner">
              <span class="year-header-arrow ${collapsed ? '' : 'open'}">${collapsed ? '&#9654;' : '&#9660;'}</span>
              <span class="year-header-label">${esc(year)}</span>
              <span class="year-header-stats">${t.flights} flight${t.flights !== 1 ? 's' : ''} &nbsp;·&nbsp; ${t.hours.toFixed(1)} h</span>
            </div>
          </td>
        </tr>`);
      lastYear = year;
      lastYearMonth = null;   // force month header to re-emit after year header
    }

    // ── Month header (sub-row within the year) ──
    if (showYearHeaders && yearMonth && yearMonth !== lastYearMonth) {
      const mt           = monthTotals[yearMonth] || { flights: 0, hours: 0 };
      const yearHidden   = collapsedYears.has(year);
      const monthCollapsed = collapsedMonths.has(yearMonth);
      rows.push(`
        <tr class="month-header-row" data-year="${esc(year)}" data-month="${esc(yearMonth)}"
            onclick="toggleMonthSection('${esc(yearMonth)}')"
            ${yearHidden ? 'style="display:none;"' : ''}>
          <td colspan="13">
            <div class="month-header-inner">
              <span class="month-header-arrow ${monthCollapsed ? '' : 'open'}">${monthCollapsed ? '&#9654;' : '&#9660;'}</span>
              <span class="month-header-label">${formatYearMonth(yearMonth)}</span>
              <span class="month-header-stats">${mt.flights} flight${mt.flights !== 1 ? 's' : ''} &nbsp;·&nbsp; ${mt.hours.toFixed(1)} h</span>
            </div>
          </td>
        </tr>`);
      lastYearMonth = yearMonth;
    }

    // ── Flight row ──
    const hidden   = showYearHeaders && (collapsedYears.has(year) || collapsedMonths.has(yearMonth));
    const duration = f.flt || 0;
    const durStr   = duration > 0 ? duration.toFixed(1) + ' h' : '—';
    const pClass   = operatorClass(f.partner);
    const pName    = operatorName(f.partner);
    const dateDisp = formatDate(f.date);

    const depAp  = Airports.lookup(f.departure);
    const arrAp  = Airports.lookup(f.arrival);
    const depTip = depAp ? ` title="${esc(depAp.name + ', ' + depAp.city + ', ' + depAp.state)}"` : '';
    const arrTip = arrAp ? ` title="${esc(arrAp.name + ', ' + arrAp.city + ', ' + arrAp.state)}"` : '';

    rows.push(`
      <tr data-row="${f._row}" data-year="${esc(year)}" data-month="${esc(yearMonth)}"${hidden ? ' style="display:none;"' : ''}>
        <td class="num">${f.flightNum}</td>
        <td>${dateDisp}</td>
        <td class="airport"${depTip}>${esc(f.departure)}</td>
        <td class="airport"${arrTip}>${esc(f.arrival)}</td>
        <td class="hobbs num">${f.hobbsStart.toFixed(1)}</td>
        <td class="hobbs num">${f.hobbsEnd.toFixed(1)}</td>
        <td class="duration-col num">${durStr}</td>
        <td class="num">${f.landings}</td>
        <td class="num">${f.cycles}</td>
        <td><span class="partner-badge ${pClass}">${esc(pName)}</span></td>
        <td class="pilot-col">${esc(f.pilot || '—')}</td>
        <td><span class="purpose-badge">${esc(f.purpose)}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Edit" onclick="openEditModal(${f._row})">✎</button>
            <button class="btn-icon danger" title="Delete" onclick="openDeleteModal(${f._row})">✕</button>
          </div>
        </td>
      </tr>`);
  });

  tbody.innerHTML = rows.join('');
}

// ── Flight Modal ───────────────────────────────────────────────────────────

function openAddModal() {
  editingFlight = null;
  modalTitle.textContent  = 'Log Flight';
  modalSubmit.textContent = 'Save Flight';
  flightForm.reset();
  hideFormError();

  // Auto-populate flight number and Hobbs Start from last flight
  const sorted = [...allFlights].sort((a, b) => a.flightNum - b.flightNum);
  const last   = sorted[sorted.length - 1];
  $('f-flight-num').value  = last ? last.flightNum + 1 : 1;
  $('f-hobbs-start').value = last ? last.hobbsEnd.toFixed(1) : '';
  $('f-date').value = todayISO();

  hDurationHint.textContent = '';
  flightModal.style.display = 'flex';
  $('f-date').focus();
}

function openEditModal(sheetRow) {
  const f = allFlights.find(x => x._row === sheetRow);
  if (!f) return;
  editingFlight = f;

  modalTitle.textContent  = `Edit Flight #${f.flightNum}`;
  modalSubmit.textContent = 'Update Flight';
  hideFormError();

  $('f-flight-num').value   = f.flightNum;
  $('f-date').value         = f.date;
  $('f-departure').value    = f.departure;
  $('f-arrival').value      = f.arrival;
  $('f-hobbs-start').value  = f.hobbsStart.toFixed(1);
  $('f-hobbs-end').value    = f.hobbsEnd.toFixed(1);
  $('f-landings').value     = f.landings;
  $('f-cycles').value       = f.cycles;
  $('f-partner').value      = f.partner;
  $('f-pilot').value        = f.pilot || '';
  $('f-purpose').value      = f.purpose;

  updateDurationHint();
  flightModal.style.display = 'flex';
}

function closeFlightModal() {
  flightModal.style.display = 'none';
  editingFlight = null;
}

function updateDurationHint() {
  const s = parseFloat($('f-hobbs-start').value);
  const e = parseFloat($('f-hobbs-end').value);
  if (!isNaN(s) && !isNaN(e) && e > s) {
    const flt  = Math.round((e - s) * 10) / 10;  // one decimal, same as FLT column
    const mins = Math.round(flt * 60);
    hDurationHint.textContent = `FLT: ${flt.toFixed(1)} (${mins} min)`;
    hDurationHint.classList.remove('warn');
  } else if (!isNaN(s) && !isNaN(e) && e < s) {
    hDurationHint.textContent = '⚠ Hobbs End is less than Hobbs Start';
    hDurationHint.classList.add('warn');
  } else {
    hDurationHint.textContent = '';
    hDurationHint.classList.remove('warn');
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  hideFormError();

  const hobbsStart = parseFloat($('f-hobbs-start').value);
  const hobbsEnd   = parseFloat($('f-hobbs-end').value);

  if (isNaN(hobbsStart) || isNaN(hobbsEnd)) {
    return showFormError('Hobbs Start and End are required.');
  }
  if (hobbsEnd < hobbsStart) {
    return showFormError('Hobbs End cannot be less than Hobbs Start.');
  }
  if (!$('f-partner').value) return showFormError('Please select a partner.');
  if (!$('f-purpose').value) return showFormError('Please select a purpose.');

  const flight = {
    ...(editingFlight || {}),
    flightNum:  parseInt($('f-flight-num').value, 10),
    date:       $('f-date').value,
    departure:  Airports.canonicalize($('f-departure').value),
    arrival:    Airports.canonicalize($('f-arrival').value),
    hobbsStart,
    hobbsEnd,
    landings:   parseInt($('f-landings').value, 10) || 0,
    cycles:     parseInt($('f-cycles').value,   10) || 0,
    partner:    $('f-partner').value,
    pilot:      $('f-pilot').value,
    purpose:    $('f-purpose').value,
  };

  modalSubmit.disabled = true;
  modalSubmit.textContent = editingFlight ? 'Saving…' : 'Logging…';

  try {
    if (editingFlight) {
      await Sheets.updateFlight(flight);
      const idx = allFlights.findIndex(x => x._row === flight._row);
      if (idx !== -1) allFlights[idx] = flight;
    } else {
      await Sheets.appendFlight(flight);
      // Re-fetch to get accurate row numbers after append
      allFlights = await Sheets.fetchAll();
    }
    closeFlightModal();
    renderTable();
    renderDashboard();
  } catch (err) {
    showFormError(err.message);
  } finally {
    modalSubmit.disabled = false;
    modalSubmit.textContent = editingFlight ? 'Update Flight' : 'Save Flight';
  }
}

function showFormError(msg) {
  formError.textContent    = msg;
  formError.style.display  = '';
}
function hideFormError() {
  formError.style.display = 'none';
  formError.textContent   = '';
}

// ── Delete Modal ───────────────────────────────────────────────────────────

function openDeleteModal(sheetRow) {
  const f = allFlights.find(x => x._row === sheetRow);
  if (!f) return;
  deleteTarget = f;
  deleteBody.textContent = `Delete Flight #${f.flightNum} (${f.date}, ${f.departure}→${f.arrival})? This cannot be undone.`;
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
    await Sheets.deleteFlight(deleteTarget);
    allFlights = allFlights.filter(f => f._row !== deleteTarget._row);
    // Re-fetch to get updated row numbers
    allFlights = await Sheets.fetchAll();
    closeDeleteModal();
    renderTable();
    renderDashboard();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Delete';
  }
}

// ── Config Modal ───────────────────────────────────────────────────────────

function showConfigModal() {
  const cfg = Config.load();
  cfgClientId.value  = cfg.clientId  || '';
  cfgSheetId.value   = cfg.sheetId   || '';
  cfgSheetName.value = cfg.sheetName || 'Flights';
  configError.style.display = 'none';
  configModal.style.display = 'flex';
}

function closeConfigModal() {
  configModal.style.display = 'none';
}

function saveConfig() {
  const clientId  = cfgClientId.value.trim();
  const sheetId   = cfgSheetId.value.trim();
  const sheetName = cfgSheetName.value.trim() || 'Flights';

  if (!clientId || !sheetId) {
    configError.textContent   = 'OAuth Client ID and Spreadsheet ID are required.';
    configError.style.display = '';
    return;
  }

  Config.set({ clientId, sheetId, sheetName });
  closeConfigModal();

  // Re-initialize GIS with new credentials
  initGIS();
}

// ── Sorting ────────────────────────────────────────────────────────────────

function handleSortClick(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = 'asc';
  }
  renderTable();
}

// ── Airport Autocomplete ────────────────────────────────────────────────────

/**
 * Attach typeahead behaviour to a departure/arrival input.
 * - Searches as user types (min 2 chars)
 * - Arrow keys / Enter for keyboard nav; Escape closes
 * - Selecting an option fills the ICAO code (e.g. KPAO)
 * - Handles K-prefix equivalence: typing "PAO" matches KPAO
 */
function initAirportAutocomplete(inputId) {
  const input = $(inputId);
  let dropdown  = null;  // <div class="airport-dropdown">
  let options   = [];    // current result set
  let activeIdx = -1;    // keyboard-highlighted index

  // ── Helpers ──

  function createDropdown() {
    const el = document.createElement('div');
    el.className = 'airport-dropdown';
    el.style.display = 'none';
    input.parentElement.appendChild(el);  // inside .airport-ac-wrap
    return el;
  }

  function closeDropdown() {
    if (dropdown) dropdown.style.display = 'none';
    options   = [];
    activeIdx = -1;
  }

  function setActive(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.airport-option');
    items.forEach(o => o.classList.remove('active'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('active');
      items[idx].scrollIntoView({ block: 'nearest' });
      activeIdx = idx;
    } else {
      activeIdx = -1;
    }
  }

  function selectOption(ap) {
    input.value = ap.icao;
    closeDropdown();
    input.dispatchEvent(new Event('change'));
    updateDurationHint();   // refresh hint if it's the Hobbs form (no-op otherwise)
  }

  function renderDropdown(results) {
    if (!dropdown) dropdown = createDropdown();
    if (results.length === 0) { closeDropdown(); return; }
    options   = results;
    activeIdx = -1;

    dropdown.innerHTML = results.map((ap, i) =>
      `<div class="airport-option" data-idx="${i}">
        <span class="ap-code">${esc(ap.icao)}</span>
        <span class="ap-detail">${esc(ap.name)} · ${esc(ap.city)}, ${esc(ap.state)}</span>
      </div>`
    ).join('');

    // Mousedown so it fires before the input's blur event
    dropdown.querySelectorAll('.airport-option').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectOption(options[parseInt(item.dataset.idx)]);
      });
    });

    dropdown.style.display = '';
  }

  // ── Events ──

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) { closeDropdown(); return; }
    renderDropdown(Airports.search(q, 8));
  });

  input.addEventListener('keydown', e => {
    if (!dropdown || dropdown.style.display === 'none') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectOption(options[activeIdx]);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  // Close on blur (delay allows mousedown to fire first)
  input.addEventListener('blur', () => setTimeout(closeDropdown, 160));
}

// ── Search Bar Autocomplete ─────────────────────────────────────────────────

/**
 * Attach categorised typeahead to the main search input.
 * Categories: airports · operators · pilots · flight types
 * Selecting a suggestion fills the search box and immediately filters the table.
 */
function initSearchAutocomplete() {
  const input = $('search-input');
  let dropdown  = null;
  let options   = [];
  let activeIdx = -1;

  function createDropdown() {
    const el = document.createElement('div');
    el.className = 'search-dropdown';
    el.style.display = 'none';
    input.parentElement.appendChild(el);   // inside .search-ac-wrap
    return el;
  }

  function closeDropdown() {
    if (dropdown) dropdown.style.display = 'none';
    options   = [];
    activeIdx = -1;
  }

  function setActive(idx) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.search-option');
    items.forEach(o => o.classList.remove('active'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('active');
      items[idx].scrollIntoView({ block: 'nearest' });
      activeIdx = idx;
    } else {
      activeIdx = -1;
    }
  }

  function selectOption(item) {
    input.value = item.value;
    closeDropdown();
    renderTable();
  }

  /**
   * Build suggestion list from all categories.
   * Returns array of { type, value, main, sub, cls? }
   */
  function buildSuggestions(q) {
    if (!q || q.length < 1) return [];
    const ql = q.toLowerCase();
    const results = [];

    // ── Airports ──
    const aps = Airports.search(q, 4);
    aps.forEach(ap => results.push({
      type: 'airport',
      value: ap.icao,
      main: `${ap.icao} — ${ap.name}`,
      sub:  `${ap.city}, ${ap.state}`,
    }));

    // ── Operators (deduplicated by display name) ──
    const seenNames = new Set();
    Object.entries(OPERATOR_MAP).forEach(([key, op]) => {
      if (seenNames.has(op.name)) return;
      if (op.name.toLowerCase().includes(ql) || key.toLowerCase().includes(ql)) {
        seenNames.add(op.name);
        results.push({
          type: 'operator',
          value: op.name,
          main:  op.name,
          sub:   op.category === 'current' ? 'Partner' :
                 op.category === 'former'  ? 'Former Partner' :
                 op.category === 'charter' ? 'Charter' : 'Ops',
          cls:   op.cls,
        });
      }
    });

    // ── Pilots ──
    PILOTS.forEach(p => {
      if (p.name.toLowerCase().includes(ql)) {
        results.push({
          type: 'pilot',
          value: p.name,
          main:  p.name,
          sub:   p.category === 'former' ? 'Former Pilot' : 'Pilot',
        });
      }
    });

    // ── Flight Types ──
    PURPOSES.forEach(purpose => {
      if (purpose.toLowerCase().includes(ql)) {
        results.push({
          type: 'type',
          value: purpose,
          main:  purpose,
          sub:   'Flight Type',
        });
      }
    });

    return results.slice(0, 12);
  }

  const CAT_LABEL = {
    airport:  '✈',
    operator: 'OP',
    pilot:    '🧑‍✈️',
    type:     'FT',
  };

  function renderDropdown(results) {
    if (!dropdown) dropdown = createDropdown();
    if (results.length === 0) { closeDropdown(); return; }
    options   = results;
    activeIdx = -1;

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

  // ── Events ──

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 1) { closeDropdown(); return; }
    renderDropdown(buildSuggestions(q));
  });

  input.addEventListener('keydown', e => {
    if (!dropdown || dropdown.style.display === 'none') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectOption(options[activeIdx]);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  input.addEventListener('blur', () => setTimeout(closeDropdown, 160));
}

// ── Theme Toggle ───────────────────────────────────────────────────────────

const THEME_KEY = '122jm_theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('btn-theme');
  if (theme === 'light') {
    btn.innerHTML = '&#9790;';   // crescent moon — click to go dark
    btn.title = 'Switch to dark mode';
  } else {
    btn.innerHTML = '&#9728;';   // sun — click to go light
    btn.title = 'Switch to light mode';
  }
  localStorage.setItem(THEME_KEY, theme);
}

// ── Event Bindings ─────────────────────────────────────────────────────────

function bindEvents() {
  // Theme
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);
  $('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  // Auth
  btnSignin.addEventListener('click',     () => Auth.signIn());
  btnSigninCard.addEventListener('click', () => Auth.signIn());
  btnSignout.addEventListener('click',    () => { Auth.signOut(); onSignedOut(); });

  // Add flight (header button + mobile FAB)
  btnAddFlight.addEventListener('click', openAddModal);
  if (btnFab) btnFab.addEventListener('click', openAddModal);

  // Refresh
  btnRefresh.addEventListener('click', loadFlights);

  // Dashboard date range buttons
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dashRange = btn.dataset.range;
      $('range-custom-inputs').style.display = dashRange === 'custom' ? 'flex' : 'none';
      renderDashboard();
    });
  });
  $('range-from').addEventListener('change', renderDashboard);
  $('range-to').addEventListener('change',   renderDashboard);

  // Search / filter
  $('search-input').addEventListener('input',   renderTable);
  $('filter-partner').addEventListener('change', renderTable);
  $('filter-purpose').addEventListener('change', renderTable);

  // Search bar autocomplete (airports, operators, pilots, flight types)
  initSearchAutocomplete();

  // Sort headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => handleSortClick(th.dataset.col));
  });

  // Flight modal
  $('modal-close').addEventListener('click',  closeFlightModal);
  $('modal-cancel').addEventListener('click', closeFlightModal);
  flightForm.addEventListener('submit', handleFormSubmit);

  // Hobbs duration hint
  $('f-hobbs-start').addEventListener('input', updateDurationHint);
  $('f-hobbs-end').addEventListener('input',   updateDurationHint);

  // Airport autocomplete for departure and arrival fields
  initAirportAutocomplete('f-departure');
  initAirportAutocomplete('f-arrival');

  // Delete modal
  $('delete-modal-close').addEventListener('click', closeDeleteModal);
  $('delete-cancel').addEventListener('click',      closeDeleteModal);
  $('delete-confirm').addEventListener('click',     handleDeleteConfirm);

  // Config modal
  $('btn-settings').addEventListener('click',   showConfigModal);
  $('config-modal-close').addEventListener('click', closeConfigModal);
  $('config-cancel').addEventListener('click',  closeConfigModal);
  $('config-save').addEventListener('click',    saveConfig);

  // Close modals on overlay click
  [flightModal, deleteModal, configModal].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // ESC key closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      [flightModal, deleteModal, configModal].forEach(m => {
        m.style.display = 'none';
      });
    }
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  // Parse as local date to avoid UTC offset shifting the day
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

/** "YYYY-MM" → "Feb 2024" */
function formatYearMonth(ym) {
  const [y, m] = (ym || '').split('-');
  if (!y || !m) return ym;
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// Expose for inline onclick handlers
window.openEditModal   = openEditModal;
window.openDeleteModal = openDeleteModal;

window.toggleOthers = function(btn) {
  const grid  = btn.closest('.others-toggle-row').nextElementSibling;
  const arrow = btn.querySelector('.others-toggle-arrow');
  const open  = grid.style.display === 'none';
  grid.style.display  = open ? 'grid' : 'none';
  arrow.textContent   = open ? '▼' : '▶';
  btn.classList.toggle('open', open);
};

/**
 * Toggle a year section open/closed without a full re-render.
 * When collapsing: hides all month headers + all flight rows.
 * When expanding: shows month headers; shows flight rows only for un-collapsed months.
 */
window.toggleYearSection = function(year) {
  const wasCollapsed = collapsedYears.has(year);
  if (wasCollapsed) collapsedYears.delete(year);
  else              collapsedYears.add(year);
  const nowCollapsed = !wasCollapsed;

  // Update the year header arrow
  const headerRow = tbody.querySelector(`.year-header-row[data-year="${year}"]`);
  if (headerRow) {
    const arrow = headerRow.querySelector('.year-header-arrow');
    if (arrow) {
      arrow.innerHTML = nowCollapsed ? '&#9654;' : '&#9660;';
      arrow.classList.toggle('open', !nowCollapsed);
    }
  }

  if (nowCollapsed) {
    // Hide month headers and all flight rows under this year
    tbody.querySelectorAll(`tr[data-year="${year}"]:not(.year-header-row)`).forEach(row => {
      row.style.display = 'none';
    });
  } else {
    // Show month headers (they're always visible when year is open)
    tbody.querySelectorAll(`tr[data-year="${year}"].month-header-row`).forEach(row => {
      row.style.display = '';
    });
    // Show flight rows only if their month is not independently collapsed
    tbody.querySelectorAll(`tr[data-year="${year}"][data-month]:not(.year-header-row):not(.month-header-row)`).forEach(row => {
      row.style.display = collapsedMonths.has(row.dataset.month) ? 'none' : '';
    });
  }
};

/**
 * Toggle a single month section open/closed without a full re-render.
 */
window.toggleMonthSection = function(yearMonth) {
  const wasCollapsed = collapsedMonths.has(yearMonth);
  if (wasCollapsed) collapsedMonths.delete(yearMonth);
  else              collapsedMonths.add(yearMonth);
  const nowCollapsed = !wasCollapsed;

  // Update the month header arrow
  const headerRow = tbody.querySelector(`.month-header-row[data-month="${yearMonth}"]`);
  if (headerRow) {
    const arrow = headerRow.querySelector('.month-header-arrow');
    if (arrow) {
      arrow.innerHTML = nowCollapsed ? '&#9654;' : '&#9660;';
      arrow.classList.toggle('open', !nowCollapsed);
    }
  }

  // Show / hide flight rows for this month
  tbody.querySelectorAll(`tr[data-month="${yearMonth}"]:not(.month-header-row)`).forEach(row => {
    row.style.display = nowCollapsed ? 'none' : '';
  });
};
