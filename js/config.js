/**
 * config.js
 * Persists Google Sheets connection settings in localStorage.
 * Fill these in via the ⚙ Sheets Settings dialog, or hard-code them here.
 */

const CONFIG_KEY = '122jm_config';

const Config = (() => {
  function load() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
    catch { return {}; }
  }
  function save(data) { localStorage.setItem(CONFIG_KEY, JSON.stringify(data)); }
  function get(key)   { return load()[key] || ''; }
  function set(obj)   { save({ ...load(), ...obj }); }
  function isConfigured() {
    const c = load();
    return !!(c.clientId && c.sheetId);
  }
  return { get, set, load, isConfigured };
})();

// ── Operator map ────────────────────────────────────────────────────────────
// Keys are the exact values stored in the Google Sheet.
// category: 'current' | 'former' | 'shared' | 'charter'
const OPERATOR_MAP = {
  // Current partners
  'Quake':           { name: 'Stephen Quake',    category: 'current', cls: 'p1' },
  'Ashley':          { name: 'Euan Ashley',       category: 'current', cls: 'p2' },
  'Appenzeller':     { name: 'Guido Appenzeller', category: 'current', cls: 'p3' },
  'Bonforte':        { name: 'Jeff Bonforte',     category: 'current', cls: 'p4' },
  // Former partners (all Borbolla variants normalize to one person)
  'Borbolla':        { name: 'Jorge Borbolla',    category: 'former',  cls: 'pf' },
  'Borbolla (Up)':   { name: 'Jorge Borbolla',    category: 'former',  cls: 'pf' },
  'Borbolla (pull)': { name: 'Jorge Borbolla',    category: 'former',  cls: 'pf' },
  'Borbolla (UL)':   { name: 'Jorge Borbolla',    category: 'former',  cls: 'pf' },
  'Heyman':          { name: 'Steve Heyman',       category: 'former',  cls: 'pf' },
  // Shared / operational
  'Maintenance':     { name: 'Maintenance',        category: 'shared',  cls: 'ps' },
  'All':             { name: 'All Partners',        category: 'shared',  cls: 'ps' },
  // Charter customers
  'JKE Helm':        { name: 'JKE Helm',           category: 'charter', cls: 'pc' },
  'Ouraniones':      { name: 'Ouraniones',          category: 'charter', cls: 'pc' },
};

/** Returns the display name for a raw sheet operator value. */
function operatorName(raw) {
  return OPERATOR_MAP[raw]?.name || raw || '—';
}

/** Returns the CSS badge class for a raw sheet operator value. */
function operatorClass(raw) {
  return OPERATOR_MAP[raw]?.cls || 'pu';
}

/** Returns the category for a raw sheet operator value. */
function operatorCategory(raw) {
  return OPERATOR_MAP[raw]?.category || 'unknown';
}

// Current partners in display order (for dashboard cards)
const CURRENT_PARTNERS = ['Quake', 'Ashley', 'Appenzeller', 'Bonforte'];

// All raw operator keys, grouped, for the filter dropdown
const OPERATOR_GROUPS = {
  'Current Partners': ['Quake', 'Ashley', 'Appenzeller', 'Bonforte'],
  'Former Partners':  ['Borbolla', 'Heyman'],
  'Shared / Ops':     ['Maintenance', 'All'],
  'Charter':          ['JKE Helm', 'Ouraniones'],
};

// Flight Type options (Column L — exact values used in the sheet)
const PURPOSES = [
  'Business',
  'Personal Entertainment',
  'Personal Non-Entertainment',
  'Rental',
  'Training',
  'Maintenance',
  'Charity',
  'Fuel, Reposition',
];

// Operators available when logging a NEW flight
const NEW_FLIGHT_OPERATORS = ['Quake', 'Ashley', 'Appenzeller', 'Bonforte', 'Maintenance'];

// ── Pilot roster ─────────────────────────────────────────────────────────────
// category: 'hired' | 'owner' | 'former' | 'other'
// Names are stored exactly as-is in the Google Sheet (Column J).
const PILOTS = [
  // Hired pilots (current)
  { name: 'Ben Hochman',      category: 'hired'  },
  { name: 'Libor Kovarcic',   category: 'hired'  },
  { name: 'Jason Joannides',  category: 'hired'  },
  { name: 'Steve Zanger',     category: 'hired'  },
  { name: 'Max Gavrilyuk',    category: 'hired'  },
  { name: 'Bill Banner',      category: 'hired'  },
  { name: 'Jim Whitbread',    category: 'hired'  },
  { name: 'Paul Nissley',     category: 'hired'  },
  { name: 'Jim Gruneisen',    category: 'hired'  },
  // Owner pilots (current partners who also fly)
  { name: 'Euan Ashley',      category: 'owner'  },
  { name: 'Guido Appenzeller',category: 'owner'  },
  // Former pilots
  { name: 'Curtis Haney',     category: 'former' },
  { name: 'Jorge Borbolla',   category: 'former' },
  { name: 'Steve Heyman',     category: 'former' },
  // Catch-all
  { name: 'Other',            category: 'other'  },
];

/** All pilot names available when logging a new flight (non-former). */
const ACTIVE_PILOTS = PILOTS.filter(p => p.category !== 'former');
