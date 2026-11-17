import { useState } from 'react';
import { calendarsFor, dayOfYear, fmtRange, PLANTS, plantingStatus, yearOf, type DateWindow, type Plant, type PlantCalendar } from '../engine';
import { today, useStore } from '../state/store';
import { PlantIcon, Segmented } from './bits';
import { FrostSummary } from './Location';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Where a window sits on a January-to-December bar, as percentages. Parts outside the year are cut off. */
function span(w: DateWindow, year: number): { left: string; width: string } | null {
  const days = year % 4 === 0 ? 366 : 365;
  const start = yearOf(w.start) < year ? 1 : yearOf(w.start) > year ? days + 1 : dayOfYear(w.start);
  const end = yearOf(w.end) > year ? days : yearOf(w.end) < year ? 0 : dayOfYear(w.end);
  if (end < start) return null;
  return { left: `${((start - 1) / days) * 100}%`, width: `${Math.max(1.2, ((end - start + 1) / days) * 100)}%` };
}

function Bar({ cals, year, todayPct }: { cals: PlantCalendar[]; year: number; todayPct: number | null }) {
  return (
    <div className="bar" aria-hidden="true">
      {MONTHS.map((_, i) => <span key={i} className="bar-month" style={{ left: `${(i / 12) * 100}%` }} />)}
      {cals.map((c) => {
        const parts: [string, DateWindow | undefined][] = [['indoors', c.startIndoors], ['harvest', c.harvest], ['plant', c.plantOut]];
        return parts.map(([kind, w]) => {
          const s = w && span(w, year);
          return s ? <span key={`${c.season}${kind}`} className={`bar-span bar-span--${kind}`} style={s} /> : null;
        });
      })}
      {todayPct !== null && <span className="bar-today" style={{ left: `${todayPct}%` }} />}
    </div>
  );
}

export function CalendarTab({ onGoMore }: { onGoMore: () => void }) {
  const frost = useStore((s) => s.frost);
  const place = useStore((s) => s.place);
  const plantings = useStore((s) => s.plantings);
  const weather = useStore((s) => s.weather);
  const now = today();
  // From November on, people are planning next year.
  const [year, setYear] = useState(Number(now.slice(5, 7)) >= 11 ? yearOf(now) + 1 : yearOf(now));
  const [show, setShow] = useState<'mine' | 'all'>(plantings.length ? 'mine' : 'all');
  const [open, setOpen] = useState<string | null>(null);

  const mine = new Set(plantings.map((p) => p.plantId));
  const plants: Plant[] = show === 'mine' ? PLANTS.filter((p) => mine.has(p.id)) : PLANTS;
  const todayPct = yearOf(now) === year ? ((dayOfYear(now) - 0.5) / 365) * 100 : null;
  const cond = weather ? { nightLowsF: weather.lows.slice(0, 7).map((l) => l.lowF), soilF: weather.soilF } : {};

  return (
    <div className="calendar">
      <div className="card">
        <h1>Planting calendar</h1>
        <FrostSummary place={place} frost={frost} />
        {!frost && <button className="btn btn--primary" onClick={onGoMore}>Set location or frost dates</button>}
      </div>

      {frost && (
        <>
          <div className="row row--wrap row--between">
            <Segmented label="Which plants" value={show} onChange={setShow} options={[{ value: 'mine', label: 'My plants' }, { value: 'all', label: 'All 40' }]} />
            <div className="year">
              <button className="btn" onClick={() => setYear(year - 1)} aria-label="Previous year">‹</button>
              <strong>{year}</strong>
              <button className="btn" onClick={() => setYear(year + 1)} aria-label="Next year">›</button>
            </div>
          </div>
          <p className="legend"><span className="dot dot--indoors" />Start indoors <span className="dot dot--plant" />Sow or plant out <span className="dot dot--harvest" />Harvest{todayPct !== null && <><span className="dot dot--today" />Today</>}</p>

          {plants.length === 0 && <p className="note">No plants in your bed yet. Add some in the planner, or look at all 40.</p>}
          <ul className="cal-list">
            <li className="cal-months" aria-hidden="true"><span /><div className="bar-labels">{MONTHS.map((m, i) => <span key={i}>{m}</span>)}</div></li>
            {plants.map((plant) => {
              const cals = calendarsFor(plant, frost, year);
              const isOpen = open === plant.id;
              return (
                <li key={plant.id} className="cal-row">
                  <button type="button" className="cal-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : plant.id)}>
                    <span className="cal-name"><PlantIcon plantId={plant.id} size={30} />{plant.name}</span>
                    <Bar cals={cals} year={year} todayPct={todayPct} />
                  </button>
                  {isOpen && (
                    <div className="cal-detail">
                      {cals.length === 0 && <p className="note">No planting window worked out for this plant here.</p>}
                      {cals.map((c) => (
                        <div key={c.season}>
                          <p>
                            <strong>{c.season === 'spring' ? 'Spring' : c.season === 'fall' ? 'Fall' : c.season === 'overwinter' ? 'Fall planting' : 'Cool season'}: </strong>
                            {c.startIndoors && `start indoors ${fmtRange(c.startIndoors.start, c.startIndoors.end)}, `}
                            {c.method === 'transplant' ? 'plant out' : 'sow'} {fmtRange(c.plantOut.start, c.plantOut.end)}, harvest {fmtRange(c.harvest.start, c.harvest.end)}.
                            {yearOf(now) === year && <span className={`status status--${plantingStatus(plant, c, now, cond).state}`}>{plantingStatus(plant, c, now, cond).text}</span>}
                          </p>
                          <p className="why">{c.why}</p>
                          {c.notes.map((n) => <p className="why" key={n}>{n}</p>)}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="note">Tap a plant for exact dates and the reason behind them. Dates are estimates from averages; watch the forecast in the weeks around them.</p>
        </>
      )}
    </div>
  );
}
