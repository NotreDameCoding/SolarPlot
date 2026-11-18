# Build log and decisions

## 2026-11-16: first build

**What was built:** project setup (Vite + React + TypeScript + Zustand + Vitest), the planting engine with 40 plants and about 200 tests, the garden scene as a module, and all first-pass screens.

**Decisions**
- Local-only storage for now; accounts (Supabase) come later. Share links carry the layout inside the link.
- Frost windows are computed from Open-Meteo temperature history (10%, 50%, 90% dates). Replace with NOAA/NCEI data later.
- Undo keeps snapshots of the bed instead of a command list. Simpler, same result at this size.
- The scene stays on Canvas 2D; the PixiJS move is planned for the scene phase.
- "Plan for me" lays crops in strips, tall plants away from the sun. Companion planting is hints only.
- Bed size is capped at 12 × 8 ft until the scene and planner handle larger beds well.

**AI assistance (plain statement)**
The product idea, feature decisions, art direction and approval of the scene are the student's. This first build's code, plant data draft and tests were written with Claude (Anthropic) from the student's Blueprint v2. The code was checked here by type-checking, running the engine tests, and walking through the app in a headless browser with simulated weather replies; it has not yet been run with the real Vite/Vitest toolchain or the live weather services. Update this section as the student and club members rewrite and extend the code.

**To do next**
- Run `npm install`, `npm test`, `npm run dev` and fix anything the real toolchain flags.
- Master Gardener review of `plants.ts`.
- Test on a real phone.

## 2026-11-17: redesign around the living scene

**Feedback:** the interface felt plain next to the garden, and plants were drawn wrong in the scene (giant on small beds, river showing through stems at night).

**Changes**
- Scene fixes: plants, stake lights and grass are now drawn back to front in one pass; night/rain/snow tinting is baked into each sprite instead of masking the whole frame (that mask erased plant pixels that rose above the hills); small beds no longer enlarge plants past concept-art size.
- The painted world now fills the screen behind every tab, with a different camera view per tab (garden, meadow with turbines, sky, cottage, river) and a slow pan between them. The world was extended downward (more meadow) so the camera can frame the bed above the cards on phones.
- Interface rebuilt as "storybook glass" after Apple's Liquid Glass guidance (controls float on a glass layer over edge-to-edge content): grainy translucent cards, a floating tab bar, a painted wooden bed in the planner, and colors that follow the sky (golden by day, grey in rain, pale in snow, dusky at night). The separate light/dark theme setting was removed because the sky now decides.
- Wide screens put the Garden tab's cards in a right-hand column so the bed stays in view.

## 2026-11-17: planting and visibility fixes

- The camera stays on the garden on every tab (no per-tab views, no pans).
- The scene sizes the bed to fit the screen width, so wide beds are fully visible on phones.
- Newly planted crops show as seedlings (a sprout for seeds, a few true leaves for transplants) and switch to the grown plant once about a third of the way to harvest. Transplants now start at 10% grown instead of 25%.
- One-tap planting: "Planted today" for each crop in the Plan tab's crop list, and "I planted it today" on This week tasks. Tapping a crop in the bed still lets you pick a different date.
- "Plan for me" now fills every tile: crops first share tiles evenly (up to 6 each), then the rest is shared out until the bed is full. If only big plants are chosen, more of them are added while they fit. Beds over 40 sq ft get up to 10 crops in the starter set.

## 2026-11-17: fixes from the second review

**Gardening**
- Frost dates now come from NOAA's official 1991-2020 normals for the nearest weather station (elevation-aware), built into the site by `scripts/frost-data.mjs` at deploy time. The old Open-Meteo estimate (10 years of gridded data) ran about a week early in Boise and used ~260 API calls per search; it is now only a fallback, labelled as an estimate. The script stops without writing anything if NOAA's files fail sanity checks (Boise, Fairbanks, Miami, Chicago).
- Spring harvests stop at the first fall frost (tender crops) or a few weeks after (semi-hardy and hardy).
- Basil and dill are 1 per sq ft (were 4).
- Plan for me: dense crops (9+ per sq ft) stop at 3 tiles in a mixed bed, tall single-tile plants take at most half the far edge, and big plants go to the opposite end of the far edge from the tall strip.
- The shade check now assumes the front is sunny when no sunny side is marked (as Plan for me does) and says so.

**Bugs**
- Undo steps now include the bed size, so undoing a resize restores it.
- Placing a big plant replaces everything under its footprint; moving onto occupied ground is refused (same-size swaps still work); shrinking a bed moves cut-off plants to the nearest free spot instead of on top of neighbours.

**Phones**
- The scene only animates on the Garden tab (other tabs get one still frame) and runs at most 30 frames a second.

**Art**
- New beds default to 8 ft wide by 4 ft deep (long side facing you), and Edit bed has "Turn bed a quarter turn".
- Snow keeps your crops: winter versions where they exist, otherwise your own plant dusted with snow.
- Bush bean, potato, parsley, cilantro, mint, oregano, rosemary and sage have their own pictures instead of sharing basil's.
