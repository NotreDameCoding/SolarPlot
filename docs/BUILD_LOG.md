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
