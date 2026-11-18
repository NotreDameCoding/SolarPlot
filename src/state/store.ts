import { create } from 'zustand';
import {
  autoPlan, clampToBed, fitToBed, getPlant, MAX_COLS, MAX_ROWS, overlaps, rectOf, todayISO,
  type FrostInfo, type Garden, type Harvest, type ISO, type Planting, type StartMethod, type Weather,
} from '../engine';

/**
 * The one source of truth for the app. Everything is saved in this browser only
 * (localStorage); there are no accounts or servers yet.
 */
export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** Metres above sea level, from the place search; used to pick a frost station at a similar height. */
  elev?: number;
}

export interface Settings {
  reduceMotion: boolean;
  frostAlerts: boolean;
  wateringNudge: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export interface Saved {
  version: 1;
  onboarded: boolean;
  place: Place | null;
  frost: FrostInfo | null;
  goal: 'food' | 'flowers' | 'pollinators' | 'mix';
  garden: Garden;
  plantings: Planting[];
  harvests: Harvest[];
  checklist: Record<string, boolean>;
  settings: Settings;
  weather: Weather | null;
  nextId: number;
  /** Date of the last full backup export, to nudge people who never back up. */
  lastExport: ISO | null;
}

interface Actions {
  finishOnboarding(data: Pick<Saved, 'place' | 'frost' | 'goal' | 'garden'>, plantIds: string[] | null): string[];
  setPlace(place: Place | null, frost: FrostInfo | null): void;
  setFrost(frost: FrostInfo | null): void;
  setWeather(weather: Weather | null): void;
  updateGarden(patch: Partial<Garden>): void;
  planForMe(plantIds: string[]): string[];
  addPlanting(plantId: string, x: number, y: number): void;
  /** False when the spot is taken (only same-size plants can swap). */
  movePlanting(id: string, x: number, y: number): boolean;
  /** Turn the bed a quarter turn, as if you walked round to its right-hand side. */
  rotateBed(): void;
  removePlanting(id: string): void;
  clearBed(): void;
  markPlanted(id: string, plantedOn: ISO | null, method?: StartMethod, wholeCrop?: boolean): void;
  /** Mark every tile of one crop as planted on a date (or not planted, with null). */
  plantCrop(plantId: string, plantedOn: ISO | null): void;
  undo(): void;
  redo(): void;
  addHarvest(h: Omit<Harvest, 'id'>): void;
  removeHarvest(id: string): void;
  toggleChecklist(key: string): void;
  updateSettings(patch: Partial<Settings>): void;
  importData(data: unknown): boolean;
  markExported(on: ISO): void;
  deleteEverything(): void;
}

/** One undo step: the bed and its plants together, so undoing a resize restores the size. */
export interface Snapshot { garden: Garden; plantings: Planting[] }

export type State = Saved & Actions & { past: Snapshot[]; future: Snapshot[] };

const KEY = 'solarplot:v1';
const HISTORY_LIMIT = 50;

export const DEFAULT_GARDEN: Garden = { name: 'My garden', type: 'raised', cols: 8, rows: 4, sun: 'full', sunnySide: null };

const fresh = (): Saved => ({
  version: 1,
  onboarded: false,
  place: null,
  frost: null,
  goal: 'mix',
  garden: { ...DEFAULT_GARDEN },
  plantings: [],
  harvests: [],
  checklist: {},
  settings: { reduceMotion: false, frostAlerts: true, wateringNudge: true, theme: 'auto' },
  weather: null,
  nextId: 1,
  lastExport: null,
});

const clampGarden = (g: Garden): Garden => ({
  ...g,
  cols: Math.max(1, Math.min(MAX_COLS, Math.round(g.cols) || 1)),
  rows: Math.max(1, Math.min(MAX_ROWS, Math.round(g.rows) || 1)),
});

/** Accept saved or imported data only if it has the shape we expect. */
function readSaved(raw: unknown): Saved | null {
  const d = raw as Partial<Saved> | null;
  if (!d || typeof d !== 'object' || d.version !== 1 || !d.garden || !Array.isArray(d.plantings) || !Array.isArray(d.harvests)) return null;
  const base = fresh();
  const garden = clampGarden({ ...base.garden, ...d.garden });
  return {
    ...base,
    onboarded: !!d.onboarded,
    place: d.place && typeof d.place.lat === 'number' && typeof d.place.lon === 'number' ? d.place : null,
    frost: d.frost ?? null,
    goal: d.goal ?? base.goal,
    garden,
    plantings: fitToBed(garden, d.plantings.filter((p) => p && getPlant(p.plantId) && Number.isInteger(p.x) && Number.isInteger(p.y))),
    harvests: d.harvests.filter((h) => h && getPlant(h.plantId) && typeof h.amount === 'number'),
    checklist: d.checklist ?? {},
    settings: { ...base.settings, ...d.settings },
    weather: d.weather ?? null,
    nextId: typeof d.nextId === 'number' ? d.nextId : d.plantings.length + d.harvests.length + 1,
    lastExport: typeof d.lastExport === 'string' ? d.lastExport : null,
  };
}

function load(): Saved {
  try {
    const text = localStorage.getItem(KEY);
    return (text && readSaved(JSON.parse(text))) || fresh();
  } catch {
    return fresh(); // private mode or corrupted data: start clean rather than crash
  }
}

/** The part of the state that gets saved and exported. */
export function snapshot(s: State): Saved {
  const { version, onboarded, place, frost, goal, garden, plantings, harvests, checklist, settings, weather, nextId, lastExport } = s;
  return { version, onboarded, place, frost, goal, garden, plantings, harvests, checklist, settings, weather, nextId, lastExport };
}

export const useStore = create<State>()((set, get) => {
  /** Change the plantings and remember the old ones for undo. */
  const edit = (next: Planting[], extra: Partial<Saved> = {}) =>
    set((s) => ({ plantings: next, past: [...s.past, { garden: s.garden, plantings: s.plantings }].slice(-HISTORY_LIMIT), future: [], ...extra }));

  return {
    ...load(),
    past: [],
    future: [],

    finishOnboarding(data, plantIds) {
      const garden = clampGarden(data.garden);
      const plan = plantIds ? autoPlan(garden, plantIds) : null;
      set({ ...data, garden, onboarded: true, plantings: plan?.plantings.map((p, i) => ({ ...p, id: `p${i + 1}` })) ?? [], nextId: (plan?.plantings.length ?? 0) + 1, past: [], future: [] });
      return plan?.unplaced.map((u) => u.reason) ?? [];
    },
    setPlace: (place, frost) => set({ place, frost, weather: null }),
    setFrost: (frost) => set({ frost }),
    setWeather: (weather) => set({ weather }),

    updateGarden(patch) {
      const old = get().garden;
      const garden = clampGarden({ ...old, ...patch });
      // Size and type changes are undoable; renaming or changing the sun is not worth an undo step.
      if (garden.cols !== old.cols || garden.rows !== old.rows || garden.type !== old.type) edit(fitToBed(garden, get().plantings), { garden });
      else set({ garden });
    },

    rotateBed() {
      const g = get().garden;
      // You walk round to stand at the old right-hand edge: it becomes the front.
      const turn = { right: 'front', front: 'left', back: 'right', left: 'back' } as const;
      const garden: Garden = { ...g, cols: g.rows, rows: g.cols, sunnySide: g.sunnySide ? turn[g.sunnySide] : null };
      const moved = get().plantings.map((p) => {
        const r = rectOf(p);
        return { ...p, x: g.rows - (p.y + r.h), y: p.x };
      });
      edit(fitToBed(garden, moved), { garden });
    },

    planForMe(plantIds) {
      const s = get();
      const plan = autoPlan(s.garden, plantIds);
      let id = s.nextId;
      edit(plan.plantings.map((p) => ({ ...p, id: `p${id++}` })), { nextId: id });
      return plan.unplaced.map((u) => u.reason);
    },

    addPlanting(plantId, x, y) {
      const s = get();
      const plant = getPlant(plantId);
      if (!plant) return;
      const spot = clampToBed(s.garden, { x, y, w: plant.footprint[0], h: plant.footprint[1] });
      // Placing a plant replaces everything under its whole footprint (Undo brings them back), so plants never overlap.
      const area = { ...spot, w: plant.footprint[0], h: plant.footprint[1] };
      const rest = s.plantings.filter((p) => !overlaps(area, rectOf(p)));
      edit([...rest, { id: `p${s.nextId}`, plantId, ...spot }], { nextId: s.nextId + 1 });
    },

    movePlanting(id, x, y) {
      const s = get();
      const moving = s.plantings.find((p) => p.id === id);
      if (!moving) return false;
      const from = rectOf(moving);
      const to = clampToBed(s.garden, { ...from, x, y });
      if (to.x === moving.x && to.y === moving.y) return true;
      // Dropping onto a plant with the same footprint swaps the two.
      const target = s.plantings.find((p) => p.id !== id && p.x === to.x && p.y === to.y);
      const swap = target && rectOf(target).w === from.w && rectOf(target).h === from.h;
      if (!swap) {
        // Refuse a move that would land on other plants (anything except a same-size swap).
        const dest = { ...from, ...to };
        if (s.plantings.some((p) => p.id !== id && overlaps(dest, rectOf(p)))) return false;
      }
      edit(s.plantings.map((p) => (p.id === id ? { ...p, ...to } : swap && p.id === target.id ? { ...p, x: moving.x, y: moving.y } : p)));
      return true;
    },

    removePlanting: (id) => edit(get().plantings.filter((p) => p.id !== id)),
    clearBed: () => edit([]),

    markPlanted(id, plantedOn, method, wholeCrop = false) {
      const s = get();
      const one = s.plantings.find((p) => p.id === id);
      if (!one) return;
      edit(s.plantings.map((p) => {
        if (p.id !== id && !(wholeCrop && p.plantId === one.plantId)) return p;
        const { plantedOn: _old, method: _m, ...rest } = p;
        return plantedOn ? { ...rest, plantedOn, method: method ?? getPlant(p.plantId)?.start[0] } : rest;
      }));
    },

    plantCrop(plantId, plantedOn) {
      const first = get().plantings.find((p) => p.plantId === plantId);
      if (first) get().markPlanted(first.id, plantedOn, undefined, true);
    },

    undo: () => set((s) => (s.past.length ? { ...s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [{ garden: s.garden, plantings: s.plantings }, ...s.future] } : {})),
    redo: () => set((s) => (s.future.length ? { ...s.future[0], future: s.future.slice(1), past: [...s.past, { garden: s.garden, plantings: s.plantings }] } : {})),

    addHarvest: (h) => set((s) => ({ harvests: [...s.harvests, { ...h, id: `h${s.nextId}` }], nextId: s.nextId + 1 })),
    removeHarvest: (id) => set((s) => ({ harvests: s.harvests.filter((h) => h.id !== id) })),
    toggleChecklist: (key) => set((s) => ({ checklist: { ...s.checklist, [key]: !s.checklist[key] } })),
    updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

    importData(data) {
      const saved = readSaved(data);
      if (!saved) return false;
      set({ ...saved, past: [], future: [] });
      return true;
    },
    markExported: (on) => set({ lastExport: on }),
    deleteEverything() {
      try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ }
      set({ ...fresh(), past: [], future: [] });
    },
  };
});

// Save after every change.
useStore.subscribe((state) => {
  try { localStorage.setItem(KEY, JSON.stringify(snapshot(state))); } catch { /* storage full or blocked: keep working in memory */ }
});

export const today = (): ISO => todayISO();
