/**
 * sheets.js
 * All Google Sheets API v4 interactions.
 *
 * Sheet column layout (1-indexed, row 1 = header):
 *   A  #             Flight number
 *   B  Date
 *   C  Departure     4-letter airport code
 *   D  Arrival       4-letter airport code
 *   E  Hobbs Start
 *   F  Hobbs End
 *   G  Ldgs          Landings
 *   H  Cycles
 *   I  Operator
 *   J  Pilot         ← NEW column (insert between old I and J in the sheet)
 *   K  FLT           Computed flight time (HobbsEnd − HobbsStart)
 *   L  Flight Type   Purpose of the flight
 *
 * Columns M+ are ignored.
 *
 * ⚠ MIGRATION: Before deploying this version, insert a blank column J
 *   in the "Flights" sheet tab (right-click column J header → Insert 1 left),
 *   then rename the new column header to "Pilot".
 */

const Sheets = (() => {

  const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

  const HEADERS = [
    '#', 'Date', 'Departure', 'Arrival',
    'Hobbs Start', 'Hobbs End', 'Ldgs', 'Cycles',
    'Operator', 'Pilot', 'FLT', 'Flight Type',
  ];

  function sheetId()   { return Config.get('sheetId'); }
  function sheetName() { return Config.get('sheetName') || 'Flights'; }
  function range(r)    { return `${sheetName()}!${r}`; }

  async function apiFetch(path, opts = {}) {
    const token = await Auth.ensureToken();
    const url = `${BASE}/${sheetId()}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  /**
   * Ensure the sheet has a header row. If completely empty, write our headers.
   */
  async function ensureHeaders() {
    const data = await apiFetch(`/values/${encodeURIComponent(range('A1:L1'))}`);
    const row  = (data.values || [])[0] || [];
    if (row.length === 0) {
      await apiFetch(`/values/${encodeURIComponent(range('A1:L1'))}?valueInputOption=RAW`, {
        method: 'PUT',
        body: JSON.stringify({ values: [HEADERS] }),
      });
    }
  }

  /**
   * Fetch all flights. Returns array of flight objects.
   * Reads A:L and skips any row where every cell is empty.
   */
  async function fetchAll() {
    await ensureHeaders();
    const data = await apiFetch(`/values/${encodeURIComponent(range('A2:L'))}`);
    const rows = data.values || [];
    return rows
      .map((r, i) => rowToFlight(r, i + 2))   // +2: row 1 is header
      .filter(f => f.flightNum > 0 || f.date); // skip genuinely empty rows
  }

  /**
   * Append a new flight row.
   */
  async function appendFlight(flight) {
    await ensureHeaders();
    const row = flightToRow(flight);
    await apiFetch(
      `/values/${encodeURIComponent(range('A:L'))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [row] }) }
    );
    return flight;
  }

  /**
   * Update an existing flight row by its sheet row number.
   */
  async function updateFlight(flight) {
    const r = flight._row;
    if (!r) throw new Error('Missing _row on flight object');
    const row = flightToRow(flight);
    await apiFetch(
      `/values/${encodeURIComponent(range(`A${r}:L${r}`))}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', body: JSON.stringify({ values: [row] }) }
    );
    return flight;
  }

  /**
   * Delete a flight row entirely (shifts rows up, keeps row numbers consistent).
   */
  async function deleteFlight(flight) {
    const r = flight._row;
    if (!r) throw new Error('Missing _row on flight object');

    // Resolve the sheet's internal numeric sheetId
    const meta = await apiFetch('');
    const sheetMeta = (meta.sheets || []).find(s => s.properties.title === sheetName());
    if (!sheetMeta) throw new Error(`Sheet tab "${sheetName()}" not found`);
    const numericSheetId = sheetMeta.properties.sheetId;

    await apiFetch(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId:    numericSheetId,
              dimension:  'ROWS',
              startIndex: r - 1,  // 0-indexed
              endIndex:   r,
            },
          },
        }],
      }),
    });
  }

  // ── Conversion helpers ──────────────────────────────────────────────────

  function rowToFlight(row, sheetRow) {
    const hobbsStart = parseFloat(row[4]) || 0;
    const hobbsEnd   = parseFloat(row[5]) || 0;
    return {
      _row:       sheetRow,
      flightNum:  parseFloat(row[0]) || 0,
      date:       normalizeDate(row[1] || ''),
      departure:  (row[2] || '').toUpperCase().trim(),
      arrival:    (row[3] || '').toUpperCase().trim(),
      hobbsStart,
      hobbsEnd,
      landings:   parseInt(row[6], 10) || 0,
      cycles:     parseInt(row[7], 10) || 0,
      partner:    (row[8]  || '').trim(),   // Column I — Operator (raw key, e.g. "Quake")
      pilot:      (row[9]  || '').trim(),   // Column J — Pilot (full name, e.g. "Ben Hochman")
      flt:        parseFloat(row[10]) || 0, // Column K — FLT (authoritative flight time)
      purpose:    (row[11] || '').trim(),   // Column L — Flight Type
    };
  }

  function flightToRow(f) {
    const flt = Math.max(0, (f.hobbsEnd || 0) - (f.hobbsStart || 0));
    return [
      f.flightNum,
      f.date,
      (f.departure || '').toUpperCase().trim(),
      (f.arrival   || '').toUpperCase().trim(),
      f.hobbsStart,
      f.hobbsEnd,
      f.landings,
      f.cycles,
      f.partner,
      f.pilot   || '',                     // Column J — Pilot
      parseFloat(flt.toFixed(1)),          // Column K — FLT
      f.purpose,                           // Column L — Flight Type
    ];
  }

  /**
   * Normalise date values that may come in as "M/D/YYYY", "MM/DD/YYYY",
   * or already "YYYY-MM-DD". Returns ISO "YYYY-MM-DD" for consistent sorting.
   */
  function normalizeDate(raw) {
    if (!raw) return '';
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // M/D/YYYY or MM/DD/YYYY
    const parts = raw.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return raw; // return as-is and hope for the best
  }

  return { fetchAll, appendFlight, updateFlight, deleteFlight };
})();
