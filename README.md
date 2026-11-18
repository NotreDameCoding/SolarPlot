# SolarPlot

A free, phone-first garden planner for beginners in the US. It tells you what to plant, where and when, and shows your bed as a living painted scene that follows the real sky.

## Run it

```
npm install
npm run dev      # open the address it prints
npm test         # planting-engine tests
npm run frost-data   # optional locally: download NOAA frost dates (needs internet)
npm run build    # static site in dist/, ready for Netlify, Cloudflare Pages or GitHub Pages
```

## What works now

- **Onboarding:** town or ZIP, bed size, sun, goal, then "plan it for me" or a blank grid.
- **Planner:** square-foot grid, 40 plants, tap to place, move, swap, remove, undo and redo, "plan for me", hints and warnings that never block.
- **Calendar:** frost-aware windows (start indoors, plant out, harvest) with a one-sentence reason for each.
- **Garden scene:** the approved painterly scene, drawing your own bed in clear, rain, snow and night, driven by live weather.
- **Frost warning, weekly watering check, bed-prep checklist, harvest log, share link, data export, import and delete.**

Everything is saved in the browser (localStorage). There are no accounts or servers.

## Not built yet (from Blueprint v2)

Google sign-in and Supabase, email and push alerts, container gardens, the "Notify me about Pro" button, offline service worker, PixiJS (the scene is plain Canvas 2D), per-phase growth sprites (plants scale with age instead), drag-to-move on touch (tap a plant, then Move).

## Things to know

- **Plant data is a first draft** and has not been reviewed by a Master Gardener. See `src/engine/plants.ts`.
- **Frost dates come from NOAA** 1991–2020 climate normals for the nearest weather station. `npm run frost-data` builds `public/frost-stations.json` (the deploy workflow does this automatically). Without that file the app falls back to estimating from 10 years of Open-Meteo records, which runs early and costs about 260 Open-Meteo calls per lookup.
- **Open-Meteo is free for non-commercial use only**, so the app must stay free while it uses it.
- Several plants borrow a look-alike sprite (for example, cucumbers use the bean trellis) until they get their own art.

## Layout

- `src/engine/` planting rules and data, no browser code, fully tested (`__tests__/`)
- `src/scene/scene.js` the garden scene
- `src/state/store.ts` app state (Zustand) and saving
- `src/api/climate.ts` weather and place lookups
- `src/ui/` screens

See `docs/BUILD_LOG.md` for decisions and the AI-assistance statement.
