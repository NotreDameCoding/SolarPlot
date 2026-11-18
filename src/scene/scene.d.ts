export type SceneMode = 'clear' | 'rain' | 'snow' | 'night';

export interface SceneCell {
  /** Sprite key, e.g. 'tom'. */
  k: string;
  /** Top-left tile, counted from the back-left corner of the bed. */
  gx: number;
  gy: number;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Growth, 0 (just planted) to 1 (full size). */
  g: number;
}

export interface SceneGarden {
  cols: number;
  rows: number;
  cells: SceneCell[];
}

export type SceneViewName = 'garden' | 'meadow' | 'sky' | 'cottage' | 'river' | 'wide';

export interface Scene {
  setView(view: SceneViewName): void;
  setMode(mode: SceneMode): void;
  setGarden(garden: SceneGarden | null): void;
  setStill(still: boolean): void;
  destroy(): void;
}

export function createScene(canvas: HTMLCanvasElement, options?: { mode?: SceneMode; garden?: SceneGarden | null; still?: boolean; view?: SceneViewName }): Scene;
/** A painted plant sprite as a PNG data URL, for icons. Empty string if the browser cannot draw it. */
export function spriteURL(key: string): string;
export const SPRITE_KEYS: string[];
