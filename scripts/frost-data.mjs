/**
 * Builds public/frost-stations.json from NOAA's official 1991-2020 U.S. Climate Normals
 * (annual/seasonal), so the app can look up frost dates for the nearest weather station
 * with no API calls at all.
 *
 *   npm run frost-data        (needs internet; downloads the NOAA archive once)
 *
 * For each station it keeps the 10%, 50% and 90% probability dates of the last spring
 * and first fall 32°F night, stored as day-of-year numbers, plus a rough hardiness zone
 * for warm places. The deploy workflow runs this before every build.
 *
 * If anything about NOAA's files looks wrong, the script stops without writing a file,
 * and the app falls back to estimating frost dates from Open-Meteo.
 */
import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = 'https://www.ncei.noaa.gov/data/normals-annualseasonal/1991-2020/';
const OUT = new URL('../public/frost-stations.json', import.meta.url);
const KEYS = { ls: 'ann-tmin-prblst-t32fp', ff: 'ann-tmin-prbfst-t32fp', occ: 'ann-tmin-prbocc-lsth0' };

async function get(url, as = 'text') {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return as === 'text' ? await res.text() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 3) throw new Error(`Could not download ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** Minimal tar reader (ustar + GNU long names). */
function* untar(buf) {
  let off = 0;
  let longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.toString('utf8', a, b).replace(/\0.*$/s, '');
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const prefix = str(345, 500);
    const name = longName ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
    off += 512;
    const data = buf.subarray(off, off + size);
    off += Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = data.toString('utf8').replace(/\0.*$/s, ''); continue; }
    longName = null;
    if (type === '0' || type === '\0') yield { name, data };
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** One station CSV -> raw record (or null if it has no freeze data). */
function readStation(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return null;
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const val = (key) => {
    const i = head.indexOf(key);
    return i === -1 ? undefined : rows[1][i]?.trim();
  };
  const num = (key) => {
    const v = val(key);
    if (v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const id = val('station');
  const lat = num('latitude'), lon = num('longitude');
  if (!id || lat === null || lon === null) return null;
  const pick = (base) => [1, 5, 9].map((p) => num(`${base}${p}0`));
  return {
    id, name: val('name') ?? id, lat, lon, elev: num('elevation'),
    ls: pick(KEYS.ls), ff: pick(KEYS.ff),
    occ: [16, 20, 24, 28, 32].map((t) => num(`${KEYS.occ}${String(t).padStart(2, '0')}`)),
  };
}

async function loadStations() {
  // Preferred: one archive with every station's file.
  const listing = await get(`${ROOT}archive/`);
  const archive = [...listing.matchAll(/href="([^"]+\.tar\.gz)"/gi)]
    .map((m) => m[1])
    .filter((n) => /by-station/i.test(n) && /annualseasonal/i.test(n))
    .sort()
    .pop();
  if (archive) {
    const url = new URL(archive, `${ROOT}archive/`).href;
    console.log(`Downloading ${url}`);
    const tar = gunzipSync(await get(url, 'buffer'));
    const out = [];
    for (const f of untar(tar)) if (f.name.toLowerCase().endsWith('.csv')) {
      const s = readStation(f.data.toString('utf8'));
      if (s) out.push(s);
    }
    return out;
  }
  // Fallback: one file per station from the access folder.
  console.log('No archive found; downloading station files one by one (slow).');
  const files = [...(await get(`${ROOT}access/`)).matchAll(/href="([A-Z0-9]{11}\.csv)"/g)].map((m) => m[1]);
  const out = [];
  for (let i = 0; i < files.length; i += 24) {
    const batch = await Promise.all(files.slice(i, i + 24).map((f) => get(`${ROOT}access/${f}`).catch(() => null)));
    for (const text of batch) { const s = text && readStation(text); if (s) out.push(s); }
    if (i % 1200 === 0) console.log(`  ${i} / ${files.length}`);
  }
  return out;
}

/**
 * NOAA's documentation doesn't say whether dates are MMDD or day-of-year, so work it out:
 * day-of-year values like 145 can't be MMDD (no 45th day of January).
 */
function dateDecoder(stations) {
  let doyEvidence = 0, mmddEvidence = 0;
  for (const s of stations) for (const v of [...s.ls, ...s.ff]) {
    if (v === null || v <= 0) continue;
    const mm = Math.floor(v / 100), dd = v % 100;
    if (v > 366) mmddEvidence++;
    else if (mm < 1 || mm > 12 || dd < 1 || dd > 31) doyEvidence++;
  }
  const doy = doyEvidence > mmddEvidence;
  console.log(`Date format: ${doy ? 'day of year' : 'MMDD'} (evidence ${doyEvidence} vs ${mmddEvidence})`);
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return (v) => {
    if (v === null || v <= 0) return null; // negative codes mean "never" or "missing"
    if (doy) return v >= 1 && v <= 366 ? v : null;
    const mm = Math.floor(v / 100), dd = v % 100;
    return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? cum[mm - 1] + dd : null;
  };
}

/** Warm-zone estimate from how often each temperature is reached in a year. Null for zone 8 and colder. */
function warmZone(occ) {
  if (occ.some((p) => p === null)) return null;
  const pct = occ.map((p) => (p <= 1 ? p * 100 : p));
  const [p16, p20, p24, p28, p32] = pct;
  if (p16 >= 50) return null; // an average year reaches 16°F or colder: zone 8 or colder
  if (p20 >= 50) return '8b';
  if (p24 >= 50) return '9a';
  if (p28 >= 50) return '9b';
  if (p32 >= 50) return '10a';
  return '10b';
}

async function main() {
  const raw = await loadStations();
  console.log(`Read ${raw.length} stations.`);
  const decode = dateDecoder(raw);
  const stations = [];
  for (const s of raw) {
    const ls = s.ls.map(decode), ff = s.ff.map(decode);
    const occ32 = s.occ[4] === null ? null : s.occ[4] <= 1 ? s.occ[4] * 100 : s.occ[4];
    const frostFree = occ32 !== null && occ32 < 50;
    const complete = ls.every((v) => v !== null) && ff.every((v) => v !== null);
    if (!complete && !frostFree) continue;
    stations.push([s.id, s.name.slice(0, 40), +s.lat.toFixed(3), +s.lon.toFixed(3), s.elev === null ? null : Math.round(s.elev), ...(complete ? ls : [null, null, null]), ...(complete ? ff : [null, null, null]), frostFree ? 1 : 0, warmZone(s.occ)]);
  }

  // Sanity checks against places whose frost dates are well known. Stop rather than ship bad data.
  const byId = new Map(stations.map((s) => [s[0], s]));
  const check = (id, label, ok) => {
    const s = byId.get(id);
    if (!s) { console.warn(`  (check skipped: ${label} station ${id} not found)`); return; }
    if (!ok(s)) throw new Error(`Sanity check failed for ${label}: ${JSON.stringify(s)}`);
    console.log(`  ok: ${label} last frost 10/50/90% = day ${s[5]}/${s[6]}/${s[7]}, first frost day ${s[8]}/${s[9]}/${s[10]}`);
  };
  if (stations.length < 2000) throw new Error(`Only ${stations.length} usable stations; expected thousands.`);
  check('USW00024131', 'Boise, ID', (s) => s[6] >= 91 && s[6] <= 151 && s[5] < s[6] && s[6] < s[7] && s[9] >= 250 && s[9] <= 310);
  check('USW00026411', 'Fairbanks, AK', (s) => s[6] >= 121 && s[9] <= 270);
  check('USW00012839', 'Miami, FL', (s) => s[11] === 1 || (s[6] !== null && s[6] < 60));
  check('USW00094846', "Chicago O'Hare, IL", (s) => s[6] >= 91 && s[6] <= 140);

  mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    source: 'NOAA NCEI U.S. Climate Normals 1991-2020 (annual/seasonal), 32°F freeze probabilities',
    built: new Date().toISOString().slice(0, 10),
    fields: ['id', 'name', 'lat', 'lon', 'elevM', 'lastSpring10', 'lastSpring50', 'lastSpring90', 'firstFall10', 'firstFall50', 'firstFall90', 'frostFree', 'warmZone'],
    stations,
  }));
  console.log(`Wrote ${stations.length} stations to public/frost-stations.json`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
