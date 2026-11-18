import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  checkGarden, density, fmtDate, getPlant, MAX_COLS, MAX_ROWS, plantCounts, plantingAt, PLANTS, rectOf, starterSet, worstLevels,
  type Category, type Garden, type Planting,
} from '../engine';
import { today, useStore } from '../state/store';
import { PlantIcon, Segmented, Sheet, Stepper, SUN_LABEL } from './bits';
import { PlantSheet } from './PlantSheet';

const CATEGORY_TABS: { value: Category | 'all'; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'vegetable', label: 'Vegetables' }, { value: 'herb', label: 'Herbs' }, { value: 'flower', label: 'Flowers' },
];
const LEVEL_WORD = { problem: 'Problem', caution: 'Caution', hint: 'Hint' } as const;

export function PlanTab({ onLogHarvest }: { onLogHarvest: (plantId: string) => void }) {
  const garden = useStore((s) => s.garden);
  const plantings = useStore((s) => s.plantings);
  const frost = useStore((s) => s.frost);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const { addPlanting, movePlanting, undo, redo, clearBed, plantCrop } = useStore.getState();

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [armed, setArmed] = useState<string | null>(null); // plant chosen in the drawer, waiting for a tile
  const [selected, setSelected] = useState<string | null>(null); // planting whose sheet is open
  const [moving, setMoving] = useState<string | null>(null); // planting waiting for a destination tile
  const [info, setInfo] = useState<string | null>(null); // plant whose info sheet is open (from the drawer)
  const [sheet, setSheet] = useState<'bed' | 'auto' | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const grid = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ id: string; px: number; py: number; dx: number; dy: number; active: boolean } | null>(null);
  const justDragged = useRef(false);

  const issues = useMemo(() => checkGarden(garden, plantings, frost), [garden, plantings, frost]);
  const levels = useMemo(() => worstLevels(issues), [issues]);
  const counts = useMemo(() => plantCounts(garden, plantings), [garden, plantings]);
  const armedPlant = armed ? getPlant(armed) : undefined;
  const selectedPlanting = plantings.find((p) => p.id === selected);
  const movingPlanting = plantings.find((p) => p.id === moving);

  const tapTile = (x: number, y: number) => {
    if (justDragged.current) { justDragged.current = false; return; }
    if (moving) { movePlanting(moving, x, y); setMoving(null); return; }
    if (armed) { addPlanting(armed, x, y); return; }
    const hit = plantingAt(plantings, x, y);
    if (hit) setSelected(hit.id);
  };

  /** Which tile is under the pointer. */
  const tileAt = (clientX: number, clientY: number) => {
    const box = grid.current!.getBoundingClientRect();
    return { x: Math.floor(((clientX - box.left) / box.width) * garden.cols), y: Math.floor(((clientY - box.top) / box.height) * garden.rows) };
  };

  // Mouse users can drag a plant directly. On touch, tap a plant and choose Move, so scrolling the page still works.
  const onPointerDown = (e: ReactPointerEvent, p: Planting) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || armed || moving) return;
    const t = tileAt(e.clientX, e.clientY);
    dragStart.current = { id: p.id, px: e.clientX, py: e.clientY, dx: t.x - p.x, dy: t.y - p.y, active: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragStart.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.px, e.clientY - d.py) < 6) return;
    d.active = true;
    const t = tileAt(e.clientX, e.clientY);
    setDrag({ id: d.id, x: t.x - d.dx, y: t.y - d.dy });
  };
  const onPointerUp = () => {
    const d = dragStart.current;
    dragStart.current = null;
    if (d?.active && drag) {
      movePlanting(drag.id, drag.x, drag.y);
      justDragged.current = true;
    }
    setDrag(null);
  };

  const sunWord = garden.sun === 'full' ? 'full sun' : garden.sun === 'part' ? 'part sun' : 'shade';
  const palette = PLANTS.filter((p) => category === 'all' || p.category === category);

  return (
    <div className="plan">
      <div className="glass card bed-card">
        <div className="bed-head">
          <div>
            <h1>{garden.name}</h1>
            <p className="note">{garden.cols} × {garden.rows} ft {garden.type === 'raised' ? 'raised bed' : 'in-ground bed'} · {sunWord}</p>
          </div>
          <button className="btn" onClick={() => setSheet('bed')}>Edit bed</button>
        </div>
        <div className="toolbar">
          <button className="btn btn--small" onClick={undo} disabled={!canUndo}>Undo</button>
          <button className="btn btn--small" onClick={redo} disabled={!canRedo}>Redo</button>
          <button className="btn btn--small btn--primary" onClick={() => setSheet('auto')}>Plan for me</button>
          <button className="btn btn--small btn--quiet" onClick={clearBed} disabled={plantings.length === 0}>Clear</button>
        </div>
      </div>

      {(armedPlant || movingPlanting) && (
        <p className="glass armed" role="status">
          {armedPlant && <>Tap a tile to plant <strong>{armedPlant.name}</strong>{armedPlant.footprint[0] * armedPlant.footprint[1] > 1 ? ` (${armedPlant.footprint[0]} × ${armedPlant.footprint[1]} ft)` : ''}.</>}
          {movingPlanting && <>Tap the tile to move <strong>{getPlant(movingPlanting.plantId)?.name}</strong> to.</>}
          <button className="btn btn--quiet" onClick={() => { setArmed(null); setMoving(null); }}>Done</button>
        </p>
      )}

      <div className="glass bed-wrap">
        <p className={`edge ${garden.sunnySide === 'back' ? 'edge--sun' : ''}`}>Back{garden.sunnySide === 'back' ? ' · sunny side' : ''}</p>
        <div className="bed-row">
          {garden.sunnySide === 'left' && <p className="edge edge--side edge--sun">Sunny side</p>}
          <div ref={grid} className={`bed-grid ${armed || moving ? 'is-placing' : ''}`}
            style={{ gridTemplateColumns: `repeat(${garden.cols}, 1fr)`, aspectRatio: `${garden.cols} / ${garden.rows}`, maxWidth: `${Math.min(garden.cols * 88, 720)}px` }}>
            {Array.from({ length: garden.rows * garden.cols }, (_, i) => {
              const x = i % garden.cols;
              const y = Math.floor(i / garden.cols);
              return <button key={i} type="button" className="tile" style={{ gridColumn: x + 1, gridRow: y + 1 }} onClick={() => tapTile(x, y)} aria-label={`Row ${y + 1}, column ${x + 1}: ${getPlant(plantingAt(plantings, x, y)?.plantId ?? '')?.name ?? 'empty'}`} />;
            })}
            {plantings.map((p) => {
              const plant = getPlant(p.plantId);
              if (!plant) return null;
              const r = rectOf(p);
              const at = drag?.id === p.id ? drag : p;
              const level = levels.get(p.id);
              const per = density(plant, garden.type);
              return (
                <div key={p.id}
                  className={`planting ${level ? `planting--${level}` : ''} ${p.plantedOn ? 'is-planted' : ''} ${moving === p.id || drag?.id === p.id ? 'is-moving' : ''}`}
                  style={{ gridColumn: `${Math.max(1, at.x + 1)} / span ${r.w}`, gridRow: `${Math.max(1, at.y + 1)} / span ${r.h}` }}
                  onPointerDown={(e) => onPointerDown(e, p)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                  onClick={(e) => { const t = tileAt(e.clientX, e.clientY); tapTile(t.x, t.y); }}>
                  <PlantIcon plantId={plant.id} size={48} />
                  <span className="planting-name">{plant.name}</span>
                  {per > 1 && <span className="planting-count">×{per}</span>}
                </div>
              );
            })}
          </div>
          {garden.sunnySide === 'right' && <p className="edge edge--side edge--sun">Sunny side</p>}
        </div>
        <p className={`edge ${garden.sunnySide === 'front' ? 'edge--sun' : ''}`}>Front, nearest you{garden.sunnySide === 'front' ? ' · sunny side' : ''}</p>
      </div>

      {notes.length > 0 && (
        <div className="glass card card--caution" role="status">
          {notes.map((n) => <p key={n}>{n}</p>)}
          <button className="btn btn--quiet" onClick={() => setNotes([])}>OK</button>
        </div>
      )}

      <section className="glass drawer" aria-label="Plants to add">
        <Segmented label="Plant type" value={category} onChange={setCategory} options={CATEGORY_TABS} />
        <div className="palette">
          {palette.map((p) => (
            <button key={p.id} type="button" className={`palette-item ${armed === p.id ? 'is-on' : ''}`} aria-pressed={armed === p.id}
              onClick={() => { setMoving(null); setArmed(armed === p.id ? null : p.id); }}>
              <PlantIcon plantId={p.id} size={44} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
        {armedPlant
          ? <button className="btn btn--quiet" onClick={() => setInfo(armedPlant.id)}>About {armedPlant.name.toLowerCase()}</button>
          : <p className="note">Pick a plant, then tap tiles to place it. Tap a placed plant to move or remove it.</p>}
      </section>

      {plantings.length > 0 && (
        <section className="glass card">
          <h2>In this bed</h2>
          <p className="note">Mark each crop as planted when it goes in. The garden scene then grows it from a seedling.</p>
          <ul className="crop-list">
            {[...counts].map(([id, n]) => {
              const plant = getPlant(id)!;
              const tiles = plantings.filter((p) => p.plantId === id);
              const planted = tiles.find((p) => p.plantedOn)?.plantedOn;
              return (
                <li key={id}>
                  <PlantIcon plantId={id} size={34} />
                  <span className="grow">
                    <strong>{n} × {plant.name}</strong>
                    <span className="note">{planted ? `Planted ${fmtDate(planted)}` : 'Not planted yet'}</span>
                  </span>
                  {planted
                    ? <button className="btn btn--small btn--quiet" onClick={() => plantCrop(id, null)}>Undo</button>
                    : <button className="btn btn--small btn--primary" onClick={() => plantCrop(id, today())}>Planted today</button>}
                </li>
              );
            })}
          </ul>
          <p className="note">Planted on a different day? Tap the crop in the bed to set the date.</p>
        </section>
      )}

      {issues.length > 0 && (
        <section className="glass card">
          <h2>Hints and warnings</h2>
          <p className="note">Advice only. Nothing here stops you planting the way you want.</p>
          <ul className="issues">
            {issues.map((issue, i) => (
              <li key={i} className={`issue issue--${issue.level}`}>
                <span className="issue-level">{LEVEL_WORD[issue.level]}</span>
                <span>{issue.text}{issue.fix && <em> {issue.fix}</em>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedPlanting && getPlant(selectedPlanting.plantId) && (
        <PlantSheet plant={getPlant(selectedPlanting.plantId)!} planting={selectedPlanting} onClose={() => setSelected(null)}
          onMove={() => { setArmed(null); setMoving(selectedPlanting.id); setSelected(null); }} onLogHarvest={onLogHarvest} />
      )}
      {info && getPlant(info) && <PlantSheet plant={getPlant(info)!} onClose={() => setInfo(null)} />}
      {sheet === 'bed' && <BedSheet onClose={() => setSheet(null)} />}
      {sheet === 'auto' && <AutoSheet onClose={() => setSheet(null)} onNotes={setNotes} />}
    </div>
  );
}

function BedSheet({ onClose }: { onClose: () => void }) {
  const garden = useStore((s) => s.garden);
  const update = useStore((s) => s.updateGarden);
  return (
    <Sheet title="Edit bed" onClose={onClose}>
      <label>Name<input type="text" value={garden.name} maxLength={40} onChange={(e) => update({ name: e.target.value })} /></label>
      <Segmented label="Garden type" value={garden.type} onChange={(type) => update({ type })} options={[{ value: 'raised', label: 'Raised bed' }, { value: 'inground', label: 'In the ground' }]} />
      <Stepper label="Width" unit="ft" value={garden.cols} min={1} max={MAX_COLS} onChange={(cols) => update({ cols })} />
      <Stepper label="Depth" unit="ft" value={garden.rows} min={1} max={MAX_ROWS} onChange={(rows) => update({ rows })} />
      <p className="note">Shrinking the bed removes plants that no longer fit. Undo brings them back. In-ground beds are spaced one step wider than raised beds.</p>
      <h3>Sun</h3>
      <Segmented label="Sun" value={garden.sun} onChange={(sun) => update({ sun })} options={[{ value: 'full', label: '6+ hours' }, { value: 'part', label: '3–6 hours' }, { value: 'shade', label: 'Under 3' }]} />
      <p className="note">{SUN_LABEL[garden.sun]}. Most people overestimate.</p>
      <h3>Which edge faces the sun?</h3>
      <Segmented label="Sunny side" value={garden.sunnySide ?? 'none'} onChange={(v) => update({ sunnySide: v === 'none' ? null : v })}
        options={[{ value: 'none', label: 'Not sure' }, { value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
      <button className="btn btn--primary" onClick={onClose}>Done</button>
    </Sheet>
  );
}

function AutoSheet({ onClose, onNotes }: { onClose: () => void; onNotes: (n: string[]) => void }) {
  const garden = useStore((s) => s.garden) as Garden;
  const goal = useStore((s) => s.goal);
  const existing = useStore((s) => s.plantings);
  const planForMe = useStore((s) => s.planForMe);
  const [picked, setPicked] = useState<string[]>(() => {
    const mine = [...new Set(existing.map((p) => p.plantId))];
    return mine.length ? mine : starterSet(goal, garden.sun, garden.cols * garden.rows);
  });
  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  return (
    <Sheet title="Plan for me" onClose={onClose}>
      <p>Choose what you want to grow. SolarPlot arranges it: big plants first, tall plants away from the sun, each crop kept together. This replaces the current layout (Undo brings it back).</p>
      <div className="row row--wrap">
        {(['mix', 'food', 'flowers', 'pollinators'] as const).map((g) => (
          <button key={g} className="btn" onClick={() => setPicked(starterSet(g, garden.sun, garden.cols * garden.rows))}>{g === 'mix' ? 'A mix' : g[0].toUpperCase() + g.slice(1)}</button>
        ))}
      </div>
      <div className="pick-grid">
        {PLANTS.map((p) => (
          <label key={p.id} className={`pick ${picked.includes(p.id) ? 'is-on' : ''}`}>
            <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
            <PlantIcon plantId={p.id} size={30} />{p.name}
          </label>
        ))}
      </div>
      <div className="sheet-foot">
        <button className="btn btn--primary" disabled={picked.length === 0} onClick={() => { onNotes(planForMe(picked)); onClose(); }}>Arrange {picked.length} plant{picked.length === 1 ? '' : 's'}</button>
      </div>
    </Sheet>
  );
}
