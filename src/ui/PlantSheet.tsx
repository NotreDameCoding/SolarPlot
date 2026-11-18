import { useState } from 'react';
import {
  calendarsFor, density, fmtDate, fmtRange, growth, PHASE_LABEL, plantingStatus,
  type Plant, type Planting, type StartMethod,
} from '../engine';
import { today, useStore } from '../state/store';
import { PlantIcon, Sheet, SUN_LABEL } from './bits';

const FROST_WORDS = { hardy: 'Frost-hardy', semiHardy: 'Takes a light frost', tender: 'Killed by frost', veryTender: 'Needs real warmth' } as const;
const METHOD_WORDS: Record<StartMethod, string> = { seed: 'Sown as seed', transplant: 'Planted as a seedling' };
export const REPORT_URL = 'https://github.com/NotreDameCoding/SolarPlot/issues/new';

/** Everything about one plant, and the actions for one planting if given. */
export function PlantSheet({ plant, planting, onClose, onMove, onLogHarvest }: { plant: Plant; planting?: Planting; onClose: () => void; onMove?: () => void; onLogHarvest?: (plantId: string) => void }) {
  const garden = useStore((s) => s.garden);
  const frost = useStore((s) => s.frost);
  const weather = useStore((s) => s.weather);
  const plantings = useStore((s) => s.plantings);
  const markPlanted = useStore((s) => s.markPlanted);
  const remove = useStore((s) => s.removePlanting);

  const now = today();
  const [date, setDate] = useState(planting?.plantedOn ?? now);
  const [method, setMethod] = useState<StartMethod>(planting?.method ?? plant.start[0]);
  const siblings = planting ? plantings.filter((p) => p.plantId === plant.id).length : 0;
  const [whole, setWhole] = useState(true);

  const [w, h] = plant.footprint;
  const per = density(plant, garden.type);
  const cals = frost ? calendarsFor(plant, frost, Number(now.slice(0, 4))) : [];
  const cond = weather ? { nightLowsF: weather.lows.slice(0, 7).map((l) => l.lowF), soilF: weather.soilF } : {};
  const g = planting ? growth(plant, planting, now) : null;

  return (
    <Sheet title={plant.name} onClose={onClose}>
      <div className="plant-head">
        <PlantIcon plantId={plant.id} size={72} />
        <div>
          <p className="tagline">{plant.family} family · {FROST_WORDS[plant.frost]}{plant.perennial ? ' · Comes back each year' : ''}</p>
          {g && <p className="phase">{PHASE_LABEL[g.phase]}{g.phase !== 'planned' && ` · day ${g.daysIn}`}{g.harvestFrom && g.phase !== 'harvest' && g.phase !== 'done' && ` · harvest from ${fmtDate(g.harvestFrom)}`}</p>}
        </div>
      </div>

      {planting && (
        <div className="glass card card--inset">
          <h3>{planting.plantedOn ? `In the ground since ${fmtDate(planting.plantedOn, true)}` : 'Is it in the ground yet?'}</h3>
          <div className="row row--wrap">
            <label>Planted on<input type="date" value={date} max={now} onChange={(e) => setDate(e.target.value)} /></label>
            {plant.start.length > 1 && (
              <label>How
                <select value={method} onChange={(e) => setMethod(e.target.value as StartMethod)}>
                  {plant.start.map((m) => <option key={m} value={m}>{m === 'seed' ? 'From seed' : 'As a seedling'}</option>)}
                </select>
              </label>
            )}
          </div>
          {siblings > 1 && <label className="check"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />Apply to all {siblings} tiles of {plant.name.toLowerCase()}</label>}
          <div className="row row--wrap">
            <button className="btn btn--primary" disabled={!date} onClick={() => { markPlanted(planting.id, date, method, whole && siblings > 1); onClose(); }}>{planting.plantedOn ? 'Update' : 'Mark as planted'}</button>
            {planting.plantedOn && <button className="btn" onClick={() => { markPlanted(planting.id, null, undefined, whole && siblings > 1); onClose(); }}>Not planted</button>}
            {planting.plantedOn && onLogHarvest && <button className="btn" onClick={() => onLogHarvest(plant.id)}>Log a harvest</button>}
          </div>
          <div className="row row--wrap">
            {onMove && <button className="btn" onClick={onMove}>Move</button>}
            <button className="btn btn--danger" onClick={() => { remove(planting.id); onClose(); }}>Remove</button>
          </div>
        </div>
      )}

      <dl className="facts">
        <div><dt>Space</dt><dd>{w * h > 1 ? `One plant needs ${w} × ${h} ft` : `${per} per square foot`}{plant.support ? `, on a ${plant.support}` : ''}</dd></div>
        <div><dt>Sun</dt><dd>{plant.sun === 'full' ? SUN_LABEL.full : `${SUN_LABEL.part} is enough`}</dd></div>
        <div><dt>Water</dt><dd>About {plant.waterIn} inch{plant.waterIn === 1 ? '' : 'es'} a week</dd></div>
        <div><dt>Ready in</dt><dd>{plant.dtm} days from {plant.dtmFrom === 'seed' ? 'sowing' : 'transplanting'}</dd></div>
        <div><dt>Start</dt><dd>{plant.start.map((m, i) => (i ? METHOD_WORDS[m].toLowerCase() : METHOD_WORDS[m])).join(', or ')}{plant.indoorWeeks ? ` (${plant.indoorWeeks} weeks indoors first)` : ''}</dd></div>
        <div><dt>Pot</dt><dd>At least {plant.minPotGal} gallon{plant.minPotGal === 1 ? '' : 's'}</dd></div>
      </dl>

      <h3>When to plant{frost ? '' : ' (set your location to see dates)'}</h3>
      {cals.map((c) => (
        <div className="window" key={c.season}>
          <p className="window-title">{c.season === 'spring' ? 'Spring' : c.season === 'fall' ? 'Fall' : c.season === 'overwinter' ? 'Fall planting' : 'Cool season'}
            <span className={`status status--${plantingStatus(plant, c, now, cond).state}`}>{plantingStatus(plant, c, now, cond).text}</span></p>
          <ul>
            {c.startIndoors && <li><span className="dot dot--indoors" />Start seeds indoors {fmtRange(c.startIndoors.start, c.startIndoors.end)}</li>}
            <li><span className="dot dot--plant" />{c.method === 'transplant' ? 'Plant out' : 'Sow outside'} {fmtRange(c.plantOut.start, c.plantOut.end)}</li>
            <li><span className="dot dot--harvest" />Harvest {fmtRange(c.harvest.start, c.harvest.end)}</li>
          </ul>
          <p className="why">{c.why}</p>
          {c.notes.map((n) => <p className="why" key={n}>{n}</p>)}
        </div>
      ))}

      <h3>Care</h3>
      <p>{plant.care}</p>
      <p className="note">{plant.source} <a href={REPORT_URL} target="_blank" rel="noreferrer">Report a problem</a></p>
    </Sheet>
  );
}
