import { create } from 'zustand';
import {
  autoPlan, clampToBed, fitToBed, getPlant, MAX_COLS, MAX_ROWS, plantingAt, rectOf, todayISO,
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
}

interface Actions {
  finishOnboarding(data: Pick<Saved, 'place' | 'frost' | 'goal' | 'garden'>, plantIds: string[] | null): string[];
  setPlace(place: Place | null, frost: FrostInfo | null): void;
  setFrost(frost: FrostInfo | null): void;
  setWeather(weather: Weather | null): void;
  updateGarden(patch: Partial<Garden>): void;
  planForMe(plantIds: string[]): string[];
  addPlanting(plantId: string, x: number, y: number): void;
  movePlanting(id: string, x: number, y: number): void;
  removePlanting(id: string): void;
  clearBed(): void;
  markPlanted(id: string, plantedOn: ISO | null, method?: StartMethod, wholeCrop?: boolean): void;
  undo(): void;
  redo(): void;
  addHarvest(h: Omit<Harvest, 'id'>): void;
  removeHarvest(id: string): void;
  toggleChecklist(key: string): void;
  updateSettings(patch: Partial<Settings>): void;
  importData(data: unknown): boolean;
  deleteEverything(): void;
}

export type State = Saved & Actions & { past: Planting[][]; future: Planting[][] };

const KEY = 'solarplot:v1';
const HISTORY_LIMIT = 50;

export const DEFAULT_GARDEN: Garden = { name: 'My garden', type: 'raised', cols: 4, rows: 8, sun: 'full', sunnySide: null };

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
  const { version, onboarded, place, frost, goal, garden, plantings, harvests, checklist, settings, weather, nextId } = s;
  return { version, onboarded, place, frost, goal, garden, plantings, harvests, checklist, settings, weather, nextId };
}

export const useStore = create<State>()((set, get) => {
  /** Change the plantings and remember the old ones for undo. */
  const edit = (next: Planting[], extra: Partial<Saved> = {}) =>
    set((s) => ({ plantings: next, past: [...s.past, s.plantings].slice(-HISTORY_LIMIT), future: [], ...extra }));

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
      const garden = clampGarden({ ...get().garden, ...patch });
      const kept = fitToBed(garden, get().plantings);
      if (kept.length === get().plantings.length && kept.every((p, i) => p.x === get().plantings[i].x && p.y === get().plantings[i].y)) set({ garden });
      else edit(kept, { garden });
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
      // Tapping an occupied tile replaces what is there.
      const under = plantingAt(s.plantings, x, y);
      const rest = under ? s.plantings.filter((p) => p.id !== under.id) : s.plantings;
      edit([...rest, { id: `p${s.nextId}`, plantId, ...spot }], { nextId: s.nextId + 1 });
    },

    movePlanting(id, x, y) {
      const s = get();
      const moving = s.plantings.find((p) => p.id === id);
      if (!moving) return;
      const from = rectOf(moving);
      const to = clampToBed(s.garden, { ...from, x, y });
      if (to.x === moving.x && to.y === moving.y) return;
      // Dropping onto a plant with the same footprint swaps the two.
      const target = s.plantings.find((p) => p.id !== id && p.x === to.x && p.y === to.y);
      const swap = target && rectOf(target).w === from.w && rectOf(target).h === from.h;
      edit(s.plantings.map((p) => (p.id === id ? { ...p, ...to } : swap && p.id === target.id ? { ...p, x: moving.x, y: moving.y } : p)));
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

    undo: () => set((s) => (s.past.length ? { plantings: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.plantings, ...s.future] } : {})),
    redo: () => set((s) => (s.future.length ? { plantings: s.future[0], future: s.future.slice(1), past: [...s.past, s.plantings] } : {})),

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
