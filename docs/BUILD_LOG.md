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

- Tab switches cut straight to the new view instead of panning.
- The scene sizes the bed to fit the screen width, so wide beds are fully visible on phones.
- Newly planted crops show as seedlings (a sprout for seeds, a few true leaves for transplants) and switch to the grown plant once about a third of the way to harvest. Transplants now start at 10% grown instead of 25%.
- One-tap planting: "Planted today" for each crop in the Plan tab's crop list, and "I planted it today" on This week tasks. Tapping a crop in the bed still lets you pick a different date.
