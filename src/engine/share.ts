import { MAX_COLS, MAX_ROWS } from './layout';
import { PLANTS } from './plants';
import type { Garden, Planting, Sun } from './types';

/**
 * Share links carry the whole garden inside the link itself, so sharing works without
 * accounts or a server. Only the layout, the garden's name and a city name go in:
 * no coordinates, no dates, no harvest log.
 */
export interface SharedGarden {
  garden: Garden;
  plantings: Planting[];
  city: string;
}

const SUNS: Sun[] = ['full', 'part', 'shade'];

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(garden: Garden, plantings: Planting[], city = ''): string {
  const index = new Map(PLANTS.map((p, i) => [p.id, i]));
  const payload = {
    v: 1,
    n: garden.name.slice(0, 40),
    c: city.slice(0, 40),
    t: garden.type === 'raised' ? 0 : 1,
    w: garden.cols,
    h: garden.rows,
    s: SUNS.indexOf(garden.sun),
    p: plantings.filter((p) => index.has(p.plantId)).map((p) => [index.get(p.plantId), p.x, p.y]),
  };
  return toBase64Url(JSON.stringify(payload));
}

const int = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Read a share code. Returns null for anything malformed; a link is untrusted input. */
export function decodeShare(code: string): SharedGarden | null {
  try {
    const d = JSON.parse(fromBase64Url(code)) as Record<string, unknown>;
    if (d.v !== 1 || !int(d.w, 1, MAX_COLS) || !int(d.h, 1, MAX_ROWS) || !int(d.s, 0, 2) || !Array.isArray(d.p)) return null;
    if (d.p.length > MAX_COLS * MAX_ROWS) return null;
    const plantings: Planting[] = [];
    for (const item of d.p) {
      if (!Array.isArray(item)) return null;
      const [i, x, y] = item as unknown[];
      if (!int(i, 0, PLANTS.length - 1) || !int(x, 0, d.w - 1) || !int(y, 0, d.h - 1)) return null;
      plantings.push({ id: `s${plantings.length + 1}`, plantId: PLANTS[i].id, x, y });
    }
    return {
      garden: {
        name: typeof d.n === 'string' ? d.n.slice(0, 40) : 'Shared garden',
        type: d.t === 1 ? 'inground' : 'raised',
        cols: d.w,
        rows: d.h,
        sun: SUNS[d.s],
        sunnySide: null,
      },
      plantings,
      city: typeof d.c === 'string' ? d.c.slice(0, 40) : '',
    };
  } catch {
    return null;
  }
}
