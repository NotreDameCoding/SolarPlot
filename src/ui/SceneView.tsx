import { useEffect, useMemo, useRef } from 'react';
import { getPlant, growth, rectOf, type Garden, type ISO, type Planting, type SceneMode } from '../engine';
import { createScene, type Scene, type SceneGarden, type SceneViewName } from '../scene/scene.js';

/** True when nothing has a planting date yet, so the scene shows the plan fully grown. */
export const isPreview = (plantings: Planting[]) => !plantings.some((p) => p.plantedOn);

/** Turn the planner's data into what the scene draws. */
export function toSceneGarden(garden: Garden, plantings: Planting[], today: ISO): SceneGarden {
  const preview = isPreview(plantings);
  const cells = plantings.flatMap((p) => {
    const plant = getPlant(p.plantId);
    if (!plant) return [];
    const r = rectOf(p);
    if (preview) return [{ k: plant.sprite, gx: r.x, gy: r.y, w: r.w, h: r.h, g: 1 }];
    const g = growth(plant, p, today);
    if (g.phase === 'planned' || g.phase === 'done') return []; // not in the ground
    return [{ k: plant.sprite, gx: r.x, gy: r.y, w: r.w, h: r.h, g: g.fraction }];
  });
  return { cols: garden.cols, rows: garden.rows, cells };
}

interface Props {
  /** Null shows the demo bed from the concept art. */
  garden: Garden | null;
  plantings: Planting[];
  mode: SceneMode;
  today: ISO;
  still: boolean;
  view: SceneViewName;
}

const MODE_WORDS: Record<SceneMode, string> = { clear: 'on a clear golden evening', rain: 'in the rain', snow: 'under snow', night: 'at night' };

/** The living painted world behind the whole app. One canvas; each tab moves the camera. */
export function SceneView({ garden, plantings, mode, today, still, view }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const data = useMemo(() => (garden ? toSceneGarden(garden, plantings, today) : null), [garden, plantings, today]);
  const key = JSON.stringify(data);

  useEffect(() => {
    if (!canvas.current) return;
    const s = createScene(canvas.current, { mode, garden: data, still, view });
    scene.current = s;
    return () => {
      s.destroy();
      scene.current = null;
    };
    // The scene is created once; the effects below keep it in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    scene.current?.setGarden(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => scene.current?.setMode(mode), [mode]);
  useEffect(() => scene.current?.setStill(still), [still]);
  useEffect(() => scene.current?.setView(view), [view]);

  const label = garden && data
    ? `Your ${garden.cols} by ${garden.rows} foot garden bed, ${isPreview(plantings) ? `showing ${data.cells.length} planned tiles at full size (nothing planted yet)` : `with ${data.cells.length} planted tiles`}, ${MODE_WORDS[mode]}, in a river valley with wind turbines and a solar cottage.`
    : `A painted river valley ${MODE_WORDS[mode]}, with a raised garden bed, wind turbines and a solar cottage.`;
  return <canvas ref={canvas} className="backdrop" role="img" aria-label={label} />;
}
