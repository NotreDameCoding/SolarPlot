import { useMemo } from 'react';
import {
  calendarsFor, fmtDate, frostAlert, getPlant, growth, plantingStatus, wateringNudge, weeklyNeedIn,
  type Plant, type SceneMode,
} from '../engine';
import { today, useStore } from '../state/store';
import { Segmented } from './bits';
import { isPreview } from './SceneView';
import type { SceneChoice } from './sky';
import type { useWeather } from './useWeather';

export const CHECKLIST: { key: string; text: string }[] = [
  { key: 'fill', text: 'Fill the bed, or mix a few inches of compost into the soil' },
  { key: 'drainage', text: 'Check drainage: a bucket of water should soak in within minutes' },
  { key: 'weeds', text: 'Clear weeds and grass, roots and all' },
  { key: 'water', text: 'Make sure a hose or watering can reaches the bed' },
];

interface Task {
  key: string;
  text: string;
  detail: string;
  tone: 'go' | 'wait' | 'harvest';
}

interface Props {
  wx: ReturnType<typeof useWeather>;
  choice: SceneChoice;
  onChoice: (c: SceneChoice) => void;
  sky: SceneMode;
  onGoPlan: () => void;
  onGoMore: () => void;
}

export function GardenTab({ wx, choice, onChoice, sky, onGoPlan, onGoMore }: Props) {
  const plantings = useStore((s) => s.plantings);
  const frost = useStore((s) => s.frost);
  const place = useStore((s) => s.place);
  const settings = useStore((s) => s.settings);
  const checklist = useStore((s) => s.checklist);
  const toggleChecklist = useStore((s) => s.toggleChecklist);
  const { weather, loading, failed, refresh } = wx;

  const now = today();
  const preview = isPreview(plantings);

  const inGround = useMemo(() => plantings.flatMap((p) => {
    const plant = getPlant(p.plantId);
    if (!plant) return [];
    const phase = growth(plant, p, now).phase;
    return phase === 'planned' || phase === 'done' ? [] : [plant];
  }), [plantings, now]);

  const alert = weather && settings.frostAlerts ? frostAlert(weather.lows, now, inGround) : null;

  const tasks = useMemo(() => {
    const out: Task[] = [];
    const cond = weather ? { nightLowsF: weather.lows.slice(0, 7).map((l) => l.lowF), soilF: weather.soilF } : {};
    const plants = [...new Set(plantings.map((p) => p.plantId))].map(getPlant).filter((p): p is Plant => !!p);
    for (const plant of plants) {
      const mine = plantings.filter((p) => p.plantId === plant.id);
      if (mine.some((p) => growth(plant, p, now).phase === 'harvest')) {
        out.push({ key: `${plant.id}-h`, text: `${plant.name} is ready to harvest`, detail: 'Pick it, then log it in the Harvest tab.', tone: 'harvest' });
      }
      if (!frost || mine.every((p) => p.plantedOn)) continue;
      for (const cal of calendarsFor(plant, frost, Number(now.slice(0, 4)))) {
        const status = plantingStatus(plant, cal, now, cond);
        if (status.state === 'early' || status.state === 'past') continue;
        out.push({ key: `${plant.id}-${cal.season}`, text: `${plant.name}: ${status.text}`, detail: cal.why, tone: status.state === 'wait-warm' || status.state === 'soon' ? 'wait' : 'go' });
        break;
      }
    }
    return out;
  }, [plantings, frost, weather, now]);

  const nextUp = useMemo(() => {
    if (!frost || tasks.length > 0) return null;
    let best: { name: string; date: string; indoors: boolean } | null = null;
    for (const id of new Set(plantings.filter((p) => !p.plantedOn).map((p) => p.plantId))) {
      const plant = getPlant(id);
      if (!plant) continue;
      for (const year of [Number(now.slice(0, 4)), Number(now.slice(0, 4)) + 1]) {
        for (const cal of calendarsFor(plant, frost, year)) {
          const date = cal.startIndoors?.start ?? cal.plantOut.start;
          if (date > now && (!best || date < best.date)) best = { name: plant.name, date, indoors: !!cal.startIndoors };
        }
      }
    }
    return best;
  }, [plantings, frost, tasks.length, now]);

  const nudge = weather && settings.wateringNudge && inGround.length > 0 && weather.pastRainIn !== null
    ? wateringNudge(weather.pastRainIn, weather.nextRainIn ?? 0, weeklyNeedIn(plantings.filter((p) => p.plantedOn)))
    : null;
  const checklistLeft = CHECKLIST.filter((c) => !checklist[c.key]).length;

  return (
    <div className="garden">
      <div className="scene-window" aria-hidden="true" />

      <div className="glass sky-bar">
        <p className="weather-line">
          {weather
            ? <><strong>{weather.tempF !== null ? `${weather.tempF}°F` : ''}</strong> {weather.text}{place ? ` in ${place.name}` : ''}</>
            : place ? (loading ? 'Checking the weather…' : failed ? 'Weather is unavailable, so the sky shows a clear day.' : 'Weather not loaded yet.') : 'Set your location to see your real sky.'}
          {place && !loading && <button className="link" onClick={() => void refresh()}>Refresh</button>}
          {!place && <button className="link" onClick={onGoMore}>Set location</button>}
        </p>
        <Segmented label="Sky" value={choice} onChange={onChoice}
          options={[{ value: 'live', label: 'Live' }, { value: 'clear', label: 'Day' }, { value: 'rain', label: 'Rain' }, { value: 'snow', label: 'Snow' }, { value: 'night', label: 'Night' }]} />
        {weather && <p className="note">{sky === 'clear' && weather.sky === 'cloudy' ? 'Overcast skies show as a clear day for now. ' : ''}Weather from {weather.source === 'open-meteo' ? 'Open-Meteo' : weather.source === 'nws' ? 'the National Weather Service' : 'the National Weather Service and Open-Meteo'}.</p>}
      </div>

      {plantings.length === 0 ? (
        <div className="glass card">
          <h2>Your bed is empty</h2>
          <p>Add plants in the planner and they will appear here, tile for tile.</p>
          <button className="btn btn--primary" onClick={onGoPlan}>Open the planner</button>
        </div>
      ) : preview && (
        <p className="glass note scene-note">This is your plan at full size. Once you mark plants as planted in the planner, the scene shows them growing from their real planting dates.</p>
      )}

      {alert && (
        <div className={`glass card ${alert.plants.length ? 'card--alert' : 'card--quiet'}`} role={alert.plants.length ? 'alert' : 'status'}>
          <h2>{alert.level === 'freeze' ? 'Hard freeze warning' : 'Frost warning'}</h2>
          <p>{alert.text}</p>
          {alert.plants.length > 0 && <p className="note">An old bedsheet or upturned bucket over tender plants at dusk is enough for a light frost. Take it off in the morning.</p>}
        </div>
      )}

      {plantings.length > 0 && (
        <div className="glass card">
          <h2>This week</h2>
          {!frost && <p>Set your location and SolarPlot will tell you when each plant goes in. <button className="link" onClick={onGoMore}>Set location</button></p>}
          {frost && tasks.length === 0 && <p>Nothing to do right now.{nextUp && ` Next up: ${nextUp.indoors ? 'start' : 'plant'} ${nextUp.name.toLowerCase()}${nextUp.indoors ? ' seeds indoors' : ''} from ${fmtDate(nextUp.date, true)}.`}</p>}
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t.key} className={`task task--${t.tone}`}>
                <strong>{t.text}</strong>
                <span>{t.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nudge && (
        <div className={`glass card ${nudge.water ? 'card--water' : ''}`}>
          <h2>Watering</h2>
          <p>{nudge.text}</p>
          {nudge.water && <p className="note">An inch is about 0.6 gallons per square foot. Water the soil slowly, in the morning.</p>}
        </div>
      )}

      {checklistLeft > 0 && (
        <div className="glass card">
          <h2>Before you plant</h2>
          <ul className="checklist">
            {CHECKLIST.map((c) => (
              <li key={c.key}>
                <label className="check"><input type="checkbox" checked={!!checklist[c.key]} onChange={() => toggleChecklist(c.key)} />{c.text}</label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
