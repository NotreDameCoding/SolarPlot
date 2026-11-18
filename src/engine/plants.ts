import type { Category, FrostClass, Height, Plant, StartMethod, Sun } from './types';

/**
 * The 40 launch plants: 22 vegetables (and one fruit), 10 herbs, 8 flowers.
 *
 * STATUS: first draft. Values follow common university-extension planting guides and
 * square-foot spacing charts, but they have NOT yet been reviewed by a Master Gardener.
 * Every plant card in the app says so. Fixes go in docs/BUILD_LOG.md.
 */
const SOURCE = 'Draft from university extension planting guides and square-foot spacing charts. Awaiting Master Gardener review.';

interface Row {
  id: string;
  name: string;
  family: string;
  frost: FrostClass;
  start: StartMethod[];
  indoorWeeks?: number;
  dtm: number;
  dtmFrom?: StartMethod;
  harvestDays: number;
  perSqFt?: number;
  footprint?: [number, number];
  height: Height;
  support?: 'trellis' | 'cage';
  sun?: Sun;
  warm?: [soilF: number, nightF: number];
  heatLimitF?: number;
  heatStressF?: number;
  fall?: boolean;
  overwinter?: boolean;
  perennial?: boolean;
  spreads?: boolean;
  waterIn?: number;
  minPotGal: number;
  friends?: string[];
  foes?: string[];
  sprite: string;
  care: string;
}

function make(category: Category, rows: Row[]): Plant[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category,
    family: r.family,
    frost: r.frost,
    perennial: r.perennial,
    start: r.start,
    indoorWeeks: r.indoorWeeks,
    dtm: r.dtm,
    dtmFrom: r.dtmFrom ?? r.start[0],
    harvestDays: r.harvestDays,
    perSqFt: r.perSqFt ?? 1,
    footprint: r.footprint ?? [1, 1],
    height: r.height,
    support: r.support,
    sun: r.sun ?? 'full',
    minSoilF: r.warm?.[0],
    minNightF: r.warm?.[1],
    heatLimitF: r.heatLimitF,
    heatStressF: r.heatStressF,
    fall: r.fall ?? false,
    overwinter: r.overwinter,
    spreads: r.spreads,
    waterIn: r.waterIn ?? 1,
    minPotGal: r.minPotGal,
    friends: r.friends ?? [],
    foes: r.foes ?? [],
    sprite: r.sprite,
    care: r.care,
    source: SOURCE,
  }));
}

const VEGETABLES = make('vegetable', [
  { id: 'tomato', name: 'Tomato', family: 'Nightshade', frost: 'tender', start: ['transplant'], indoorWeeks: 6, dtm: 75, harvestDays: 60, footprint: [2, 2], height: 'tall', support: 'cage', warm: [60, 50], heatStressF: 90, waterIn: 1.5, minPotGal: 5, friends: ['basil', 'marigold', 'carrot', 'parsley'], foes: ['potato', 'corn'], sprite: 'tom', care: 'Plant deep, up to the first leaves, and cage it on planting day. Water at the base, evenly, to avoid cracked fruit. Pick when fully colored.' },
  { id: 'pepper', name: 'Bell pepper', family: 'Nightshade', frost: 'veryTender', start: ['transplant'], indoorWeeks: 8, dtm: 70, harvestDays: 60, height: 'medium', warm: [65, 55], minPotGal: 3, friends: ['basil', 'onion', 'marigold'], sprite: 'pep', care: 'Peppers sulk in cold soil, so do not rush them. Stake plants once fruit sets. Green peppers turn red and sweeter if left on the plant.' },
  { id: 'cucumber', name: 'Cucumber', family: 'Squash', frost: 'tender', start: ['seed', 'transplant'], indoorWeeks: 3, dtm: 55, harvestDays: 45, perSqFt: 2, height: 'tall', support: 'trellis', warm: [65, 50], waterIn: 1.5, minPotGal: 5, friends: ['bushbean', 'dill', 'nasturtium', 'sunflower'], foes: ['potato', 'sage'], sprite: 'bean', care: 'Grow it up a trellis to save space and keep fruit clean. Keep the soil evenly moist or the fruit turns bitter. Pick often so it keeps producing.' },
  { id: 'zucchini', name: 'Zucchini', family: 'Squash', frost: 'tender', start: ['seed', 'transplant'], indoorWeeks: 3, dtm: 50, harvestDays: 60, footprint: [3, 3], height: 'medium', warm: [60, 50], waterIn: 1.5, minPotGal: 10, friends: ['nasturtium', 'corn', 'bushbean'], foes: ['potato'], sprite: 'squ', care: 'One plant feeds a family, and it needs its full 3 by 3 feet. Pick fruit small, at 6 to 8 inches. Water the soil, not the leaves.' },
  { id: 'bushbean', name: 'Bush bean', family: 'Legume', frost: 'tender', start: ['seed'], dtm: 55, harvestDays: 21, perSqFt: 9, height: 'medium', warm: [60, 50], minPotGal: 2, friends: ['carrot', 'cucumber', 'corn', 'potato'], foes: ['onion', 'garlic', 'chives'], sprite: 'bbn', care: 'Sow seeds straight into warm soil; beans dislike being transplanted. No fertilizer needed. Pick every couple of days while pods are slim.' },
  { id: 'polebean', name: 'Pole bean', family: 'Legume', frost: 'tender', start: ['seed'], dtm: 65, harvestDays: 45, perSqFt: 8, height: 'tall', support: 'trellis', warm: [60, 50], minPotGal: 5, friends: ['corn', 'cucumber', 'wintersquash'], foes: ['onion', 'garlic', 'beet', 'chives'], sprite: 'bean', care: 'Put the trellis up before sowing. Pole beans crop for much longer than bush beans if you keep picking.' },
  { id: 'pea', name: 'Snap pea', family: 'Legume', frost: 'hardy', start: ['seed'], dtm: 60, harvestDays: 21, perSqFt: 8, height: 'tall', support: 'trellis', sun: 'part', heatLimitF: 80, fall: true, minPotGal: 2, friends: ['carrot', 'radish', 'lettuce'], foes: ['onion', 'garlic', 'chives'], sprite: 'bean', care: 'Sow as soon as the soil can be worked. Peas quit when summer heat arrives, so early is better than late. Give them something to climb.' },
  { id: 'lettuce', name: 'Leaf lettuce', family: 'Leafy green', frost: 'semiHardy', start: ['seed', 'transplant'], indoorWeeks: 4, dtm: 50, harvestDays: 21, perSqFt: 4, height: 'low', sun: 'part', heatLimitF: 80, fall: true, minPotGal: 1, friends: ['carrot', 'radish', 'strawberry', 'chives'], sprite: 'let', care: 'Barely cover the seed; it needs light to sprout. Pick outer leaves and the plant keeps growing. It turns bitter and bolts in heat.' },
  { id: 'spinach', name: 'Spinach', family: 'Leafy green', frost: 'hardy', start: ['seed'], dtm: 40, harvestDays: 21, perSqFt: 9, height: 'low', sun: 'part', heatLimitF: 75, fall: true, minPotGal: 1, friends: ['strawberry', 'pea', 'radish'], sprite: 'spi', care: 'One of the first crops of spring and the last of fall. It bolts fast once days turn long and warm, so sow early.' },
  { id: 'kale', name: 'Kale', family: 'Brassica', frost: 'hardy', start: ['transplant', 'seed'], indoorWeeks: 5, dtm: 55, harvestDays: 60, height: 'medium', sun: 'part', heatLimitF: 85, fall: true, minPotGal: 3, friends: ['onion', 'beet', 'dill'], foes: ['strawberry', 'tomato'], sprite: 'kal', care: 'Pick the lower leaves and leave the top to keep growing. A frost makes kale sweeter. Watch for green caterpillars under the leaves.' },
  { id: 'carrot', name: 'Carrot', family: 'Root', frost: 'semiHardy', start: ['seed'], dtm: 70, harvestDays: 30, perSqFt: 16, height: 'low', heatLimitF: 85, fall: true, minPotGal: 2, friends: ['onion', 'lettuce', 'tomato', 'rosemary', 'chives'], foes: ['dill'], sprite: 'car', care: 'Sow thinly in loose, stone-free soil and keep the surface damp until sprouts show, which can take two weeks. Thin to about 3 inches apart.' },
  { id: 'radish', name: 'Radish', family: 'Root', frost: 'hardy', start: ['seed'], dtm: 28, harvestDays: 10, perSqFt: 16, height: 'low', sun: 'part', heatLimitF: 80, fall: true, minPotGal: 1, friends: ['lettuce', 'pea', 'cucumber', 'carrot'], sprite: 'rad', care: 'The fastest crop in the garden: ready in about four weeks. Pull them promptly; old radishes turn woody and hot.' },
  { id: 'onion', name: 'Onion', family: 'Allium', frost: 'hardy', start: ['transplant'], indoorWeeks: 10, dtm: 100, harvestDays: 21, perSqFt: 9, height: 'low', minPotGal: 2, friends: ['carrot', 'beet', 'lettuce', 'strawberry'], foes: ['bushbean', 'polebean', 'pea'], sprite: 'oni', care: 'Easiest from sets or seedlings. Keep weeded; onions hate competition. Harvest when the tops flop over, then dry them in the shade.' },
  { id: 'garlic', name: 'Garlic', family: 'Allium', frost: 'hardy', start: ['seed'], dtm: 270, harvestDays: 21, perSqFt: 9, height: 'low', fall: true, overwinter: true, minPotGal: 2, friends: ['tomato', 'carrot'], foes: ['bushbean', 'polebean', 'pea'], sprite: 'gar', care: 'Plant single cloves in fall, pointed end up, and mulch. It sleeps through winter and is ready the next summer when the lower leaves brown.' },
  { id: 'beet', name: 'Beet', family: 'Root', frost: 'semiHardy', start: ['seed'], dtm: 55, harvestDays: 21, perSqFt: 9, height: 'low', sun: 'part', heatLimitF: 85, fall: true, minPotGal: 2, friends: ['onion', 'lettuce', 'kale', 'cabbage'], foes: ['polebean'], sprite: 'rad', care: 'Each "seed" is a cluster, so thin to one seedling per spot. You can eat the thinnings and the leaves.' },
  { id: 'broccoli', name: 'Broccoli', family: 'Brassica', frost: 'hardy', start: ['transplant'], indoorWeeks: 6, dtm: 60, harvestDays: 14, height: 'medium', heatLimitF: 80, fall: true, waterIn: 1.5, minPotGal: 5, friends: ['onion', 'dill', 'beet', 'calendula'], foes: ['strawberry', 'tomato'], sprite: 'kal', care: 'Cut the main head while the buds are tight and green. Smaller side shoots follow for weeks. Heat makes it flower too soon.' },
  { id: 'cabbage', name: 'Cabbage', family: 'Brassica', frost: 'hardy', start: ['transplant'], indoorWeeks: 6, dtm: 70, harvestDays: 21, height: 'medium', heatLimitF: 80, fall: true, waterIn: 1.5, minPotGal: 5, friends: ['onion', 'dill', 'beet', 'thyme'], foes: ['strawberry', 'tomato'], sprite: 'cab', care: 'Steady water gives firm heads; a sudden soaking after a dry spell can split them. Harvest when the head feels solid.' },
  { id: 'potato', name: 'Potato', family: 'Nightshade', frost: 'semiHardy', start: ['seed'], dtm: 90, harvestDays: 21, height: 'medium', waterIn: 1.5, minPotGal: 10, friends: ['bushbean', 'marigold', 'cabbage'], foes: ['tomato', 'cucumber', 'zucchini', 'sunflower'], sprite: 'pot', care: 'Plant certified seed potatoes, not grocery ones. Pile soil or mulch around the stems as they grow. Dig when the tops die back.' },
  { id: 'corn', name: 'Sweet corn', family: 'Grass', frost: 'tender', start: ['seed'], dtm: 75, harvestDays: 10, perSqFt: 4, height: 'tall', warm: [60, 50], waterIn: 1.5, minPotGal: 10, friends: ['polebean', 'zucchini', 'wintersquash', 'cucumber'], foes: ['tomato'], sprite: 'corn', care: 'Corn is pollinated by wind, so plant a block of at least four tiles, not a single row. Ears are ready when the silks turn brown.' },
  { id: 'strawberry', name: 'Strawberry', family: 'Rose', frost: 'hardy', perennial: true, start: ['transplant'], indoorWeeks: 0, dtm: 60, harvestDays: 21, perSqFt: 4, height: 'low', minPotGal: 2, friends: ['lettuce', 'spinach', 'onion', 'borage', 'thyme'], foes: ['cabbage', 'broccoli', 'kale'], sprite: 'str', care: 'Set the crown level with the soil, not buried. Mulch with straw to keep berries clean. Plants come back each year and crop best in years two and three.' },
  { id: 'chard', name: 'Swiss chard', family: 'Leafy green', frost: 'semiHardy', start: ['seed', 'transplant'], indoorWeeks: 4, dtm: 55, harvestDays: 90, perSqFt: 4, height: 'medium', sun: 'part', fall: true, minPotGal: 2, friends: ['onion', 'bushbean', 'cabbage'], sprite: 'letr', care: 'Handles both cool and warm weather better than spinach. Cut outer stalks and it keeps producing for months.' },
  { id: 'wintersquash', name: 'Butternut squash', family: 'Squash', frost: 'veryTender', start: ['seed', 'transplant'], indoorWeeks: 3, dtm: 100, harvestDays: 21, footprint: [3, 4], height: 'low', warm: [65, 55], waterIn: 1.5, minPotGal: 15, friends: ['corn', 'polebean', 'nasturtium'], foes: ['potato'], sprite: 'squ', care: 'Vines run far, so give it room or let it trail over the bed edge. Harvest when the skin is hard and tan, before frost, and cure in the sun for a week.' },
]);

const HERBS = make('herb', [
  { id: 'basil', name: 'Basil', family: 'Mint', frost: 'veryTender', start: ['transplant', 'seed'], indoorWeeks: 6, dtm: 30, harvestDays: 90, perSqFt: 1, height: 'low', warm: [60, 50], minPotGal: 1, friends: ['tomato', 'pepper'], sprite: 'bas', care: 'Pinch off the tips and any flower buds to keep it bushy. Even a cool night below 50°F can blacken the leaves.' },
  { id: 'parsley', name: 'Parsley', family: 'Carrot', frost: 'semiHardy', start: ['transplant', 'seed'], indoorWeeks: 8, dtm: 30, harvestDays: 120, perSqFt: 4, height: 'low', sun: 'part', fall: true, minPotGal: 1, friends: ['tomato', 'chives'], sprite: 'par', care: 'Slow to sprout, so seedlings are easier. Cut the outer stems at the base and new ones grow from the center.' },
  { id: 'cilantro', name: 'Cilantro', family: 'Carrot', frost: 'semiHardy', start: ['seed'], dtm: 50, harvestDays: 21, perSqFt: 9, height: 'low', sun: 'part', heatLimitF: 80, fall: true, minPotGal: 1, friends: ['spinach', 'lettuce'], sprite: 'cil', care: 'It bolts quickly in heat, so sow a little every few weeks in spring and again in fall. The seeds are coriander.' },
  { id: 'dill', name: 'Dill', family: 'Carrot', frost: 'semiHardy', start: ['seed'], dtm: 50, harvestDays: 30, perSqFt: 1, height: 'medium', minPotGal: 2, friends: ['cucumber', 'cabbage', 'broccoli', 'lettuce'], foes: ['carrot'], sprite: 'car', care: 'Sow where it will grow; the taproot dislikes moving. The flowers bring in helpful insects.' },
  { id: 'chives', name: 'Chives', family: 'Allium', frost: 'hardy', perennial: true, start: ['transplant', 'seed'], indoorWeeks: 8, dtm: 30, harvestDays: 150, perSqFt: 16, height: 'low', sun: 'part', minPotGal: 1, friends: ['carrot', 'tomato', 'lettuce'], foes: ['bushbean', 'polebean', 'pea'], sprite: 'oni', care: 'Snip leaves an inch above the soil. The clump returns every spring and the purple flowers are edible.' },
  { id: 'mint', name: 'Mint', family: 'Mint', frost: 'hardy', perennial: true, spreads: true, start: ['transplant'], indoorWeeks: 0, dtm: 30, harvestDays: 150, height: 'low', sun: 'part', minPotGal: 2, friends: ['cabbage', 'tomato'], sprite: 'min', care: 'Mint spreads by runners and will take over a bed. Grow it in a pot, even if you sink the pot into the soil.' },
  { id: 'oregano', name: 'Oregano', family: 'Mint', frost: 'hardy', perennial: true, start: ['transplant'], indoorWeeks: 8, dtm: 45, harvestDays: 150, height: 'low', minPotGal: 1, friends: ['pepper', 'tomato'], sprite: 'ore', care: 'Likes sun and soil on the dry side. Cut it back by a third before it flowers for the best flavor.' },
  { id: 'thyme', name: 'Thyme', family: 'Mint', frost: 'hardy', perennial: true, start: ['transplant'], indoorWeeks: 8, dtm: 45, harvestDays: 150, perSqFt: 4, height: 'low', minPotGal: 1, friends: ['cabbage', 'strawberry', 'tomato'], sprite: 'spi', care: 'Needs sun and good drainage and very little water once settled. Trim lightly after flowering to stop it going woody.' },
  { id: 'rosemary', name: 'Rosemary', family: 'Mint', frost: 'tender', perennial: true, start: ['transplant'], indoorWeeks: 10, dtm: 60, harvestDays: 150, height: 'medium', minPotGal: 3, friends: ['carrot', 'cabbage', 'sage'], sprite: 'ros', care: 'Evergreen where winters are mild (zone 7 and warmer). In colder places grow it in a pot and bring it inside before hard frost.' },
  { id: 'sage', name: 'Sage', family: 'Mint', frost: 'hardy', perennial: true, start: ['transplant'], indoorWeeks: 8, dtm: 60, harvestDays: 150, height: 'medium', minPotGal: 2, friends: ['carrot', 'cabbage', 'rosemary'], foes: ['cucumber'], sprite: 'sag', care: 'Give it sun and let the soil dry between waterings. Harvest lightly the first year so the plant can establish.' },
]);

const FLOWERS = make('flower', [
  { id: 'sunflower', name: 'Sunflower', family: 'Daisy', frost: 'tender', start: ['seed'], dtm: 80, harvestDays: 21, height: 'tall', warm: [55, 45], minPotGal: 5, friends: ['cucumber', 'corn', 'zucchini'], foes: ['potato', 'polebean'], sprite: 'sun', care: 'Sow straight into the ground on the far side of the bed from the sun so it does not shade its neighbors. Leave the seed heads for the birds.' },
  { id: 'zinnia', name: 'Zinnia', family: 'Daisy', frost: 'tender', start: ['seed', 'transplant'], indoorWeeks: 4, dtm: 60, harvestDays: 75, height: 'medium', warm: [60, 50], minPotGal: 1, friends: ['tomato', 'pepper', 'cucumber'], sprite: 'zin', care: 'The more you cut, the more it blooms. Water at the base; wet leaves get powdery mildew.' },
  { id: 'marigold', name: 'Marigold', family: 'Daisy', frost: 'tender', start: ['seed', 'transplant'], indoorWeeks: 6, dtm: 50, harvestDays: 90, perSqFt: 4, height: 'low', warm: [60, 50], minPotGal: 1, friends: ['tomato', 'pepper', 'potato', 'bushbean'], sprite: 'mar', care: 'Tough, cheerful and quick. Pinch off faded flowers and it blooms until frost.' },
  { id: 'nasturtium', name: 'Nasturtium', family: 'Nasturtium', frost: 'tender', start: ['seed'], dtm: 50, harvestDays: 75, height: 'low', sun: 'part', warm: [55, 45], minPotGal: 1, friends: ['cucumber', 'zucchini', 'wintersquash', 'tomato', 'radish'], sprite: 'mar', care: 'Sow where it will grow and do not fertilize; rich soil gives leaves instead of flowers. Leaves and flowers are edible and peppery.' },
  { id: 'cosmos', name: 'Cosmos', family: 'Daisy', frost: 'tender', start: ['seed', 'transplant'], indoorWeeks: 4, dtm: 60, harvestDays: 75, height: 'tall', warm: [60, 50], minPotGal: 3, friends: ['tomato', 'zucchini'], sprite: 'zin', care: 'Thrives on neglect and poor soil. Tall varieties may need a stake where it is windy.' },
  { id: 'calendula', name: 'Calendula', family: 'Daisy', frost: 'semiHardy', start: ['seed', 'transplant'], indoorWeeks: 6, dtm: 50, harvestDays: 75, height: 'low', sun: 'part', heatLimitF: 85, fall: true, minPotGal: 1, friends: ['tomato', 'kale', 'lettuce', 'broccoli'], sprite: 'mar', care: 'A cool-weather flower: best in spring and fall, and it pauses in summer heat. Petals are edible.' },
  { id: 'alyssum', name: 'Sweet alyssum', family: 'Brassica', frost: 'semiHardy', start: ['transplant', 'seed'], indoorWeeks: 6, dtm: 30, harvestDays: 90, perSqFt: 4, height: 'low', sun: 'part', fall: true, minPotGal: 1, friends: ['lettuce', 'strawberry', 'broccoli', 'cabbage'], sprite: 'mar', care: 'A low carpet of tiny honey-scented flowers that draws hoverflies. Shear it back by half if it gets leggy in midsummer.' },
  { id: 'borage', name: 'Borage', family: 'Borage', frost: 'semiHardy', start: ['seed'], dtm: 55, harvestDays: 60, height: 'medium', minPotGal: 3, friends: ['strawberry', 'tomato', 'zucchini'], sprite: 'zin', care: 'Bees love the blue star flowers. It seeds itself freely, so pull the seedlings you do not want.' },
]);

export const PLANTS: Plant[] = [...VEGETABLES, ...HERBS, ...FLOWERS];

const BY_ID = new Map(PLANTS.map((p) => [p.id, p]));

export function getPlant(id: string): Plant | undefined {
  return BY_ID.get(id);
}

/** Like getPlant, for places where an unknown id is a bug. */
export function plantOrThrow(id: string): Plant {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown plant: ${id}`);
  return p;
}

/** 'Tomatoes', 'Bush beans', 'Zucchini' */
export function plural(plant: Plant): string {
  const n = plant.name;
  if (/(zucchini|garlic|broccoli|corn|squash|spinach|kale|lettuce|chard|basil|parsley|cilantro|dill|chives|mint|oregano|thyme|rosemary|sage|cosmos|alyssum|borage|cabbage)$/i.test(n)) return n;
  if (/(to|sh)$/i.test(n)) return `${n}es`;
  if (/[^aeiou]y$/i.test(n)) return `${n.slice(0, -1)}ies`;
  return `${n}s`;
}
