import { useEffect, useMemo, useRef } from 'react';
import { getPlant, growth, rectOf, type Garden, type ISO, type Planting, type SceneMode } from '../engine';
import { createScene, type Scene, type SceneGarden } from '../scene/scene.js';

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
  garden: Garden;
  plantings: Planting[];
  mode: SceneMode;
  today: ISO;
  still: boolean;
}

const MODE_WORDS: Record<SceneMode, string> = { clear: 'on a clear golden evening', rain: 'in the rain', snow: 'under snow', night: 'at night' };

export function SceneView({ garden, plantings, mode, today, still }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const data = useMemo(() => toSceneGarden(garden, plantings, today), [garden, plantings, today]);
  const key = JSON.stringify(data);

  useEffect(() => {
    if (!canvas.current) return;
    const s = createScene(canvas.current, { mode, garden: data, still });
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

  const label = `Your ${garden.cols} by ${garden.rows} foot garden bed with ${data.cells.length} planted tiles, ${MODE_WORDS[mode]}, in a river valley with wind turbines and a solar cottage.`;
  return <canvas ref={canvas} className="scene" width={678} height={480} role="img" aria-label={label} />;
}
