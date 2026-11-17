/** Shared types for the planting engine. Nothing in src/engine touches the browser. */

/** A calendar date as 'YYYY-MM-DD'. Dates are never stored with a time or timezone. */
export type ISO = string;

export type FrostClass = 'hardy' | 'semiHardy' | 'tender' | 'veryTender';
export type Category = 'vegetable' | 'herb' | 'flower';
export type Sun = 'full' | 'part' | 'shade';
export type Height = 'low' | 'medium' | 'tall';
export type StartMethod = 'seed' | 'transplant';

export interface Plant {
  id: string;
  name: string;
  category: Category;
  family: string;
  frost: FrostClass;
  perennial?: boolean;
  /** Ways to start it outdoors. The first one is what we recommend to beginners. */
  start: StartMethod[];
  /** Weeks to grow a seedling indoors before it goes outside. */
  indoorWeeks?: number;
  /** Days to maturity, and whether seed packets count them from sowing or from transplanting. */
  dtm: number;
  dtmFrom: StartMethod;
  /** How long the harvest (or bloom) lasts once it starts. */
  harvestDays: number;
  /** Plants per square foot in a raised bed, for plants that fit in one tile. */
  perSqFt: number;
  /** True footprint in tiles (1 tile = 1 sq ft), width x depth. */
  footprint: [number, number];
  height: Height;
  support?: 'trellis' | 'cage';
  /** The least sun it needs: 'full' = 6+ hours, 'part' = 3-6 hours. */
  sun: Sun;
  /** Warm-crop gate: do not say "plant now" until soil and nights are this warm. */
  minSoilF?: number;
  minNightF?: number;
  /** Cool crops bolt or turn bitter once days are regularly hotter than this. */
  heatLimitF?: number;
  /** Fruit set stalls above this (tomatoes). */
  heatStressF?: number;
  /** Good as a fall crop, counted back from first frost. */
  fall: boolean;
  /** Planted in fall, harvested next summer (garlic). */
  overwinter?: boolean;
  /** Spreads aggressively; better in a pot. */
  spreads?: boolean;
  /** Inches of water per week. */
  waterIn: number;
  minPotGal: number;
  friends: string[];
  foes: string[];
  /** Which painted sprite the garden scene uses. Some plants borrow a look-alike for now. */
  sprite: string;
  care: string;
  source: string;
}

export interface Garden {
  name: string;
  type: 'raised' | 'inground';
  /** Width (left to right) and depth (back to front) in feet = tiles. */
  cols: number;
  rows: number;
  sun: Sun;
  /** Which edge of the bed faces the sun. 'front' is the edge nearest you in the scene. */
  sunnySide: 'front' | 'back' | 'left' | 'right' | null;
}

export interface Planting {
  id: string;
  plantId: string;
  /** Top-left tile of the footprint. x counts from the left, y from the back. */
  x: number;
  y: number;
  /** Set once it is actually in the ground. */
  plantedOn?: ISO;
  method?: StartMethod;
}

export interface Harvest {
  id: string;
  plantId: string;
  date: ISO;
  amount: number;
  unit: 'lb' | 'oz' | 'kg' | 'g' | 'count';
  note?: string;
}
