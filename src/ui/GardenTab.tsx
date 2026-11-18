import { useMemo } from 'react';
import {
  calendarsFor, fmtDate, frostAlert, getPlant, growth, plantingStatus, wateringNudge, weeklyNeedIn,
  type Plant, type SceneMode,
} from '../engine';
import { today, useStore } from '../state/store';
import { Segmented } from './bits';
import { exportBackup } from './download';
import { isPreview } from './SceneView';
import type { SceneChoice } from './sky';
import type { useWeather } from './useWeather';

export const CHECKLIST: { key: string; text: string; how: string }[] = [
  { key: 'fill', text: 'Fill the bed, or mix a few inches of compost into the soil', how: 'For a raised bed, a common mix is about 60% topsoil and 40% compost. Bagged "garden soil" works too; avoid plain potting mix, which dries out.' },
  { key: 'drainage', text: 'Check drainage', how: 'Dig a hole about a foot deep, fill it with water, and let it drain. Fill it again: the second time it should drain within a few hours. If not, raise the bed or add compost.' },
  { key: 'weeds', text: 'Clear weeds and grass, roots and all', how: 'Pull or dig them out. Under a raised bed, a layer of plain cardboard smothers grass before you fill it.' },
  { key: 'water', text: 'Make sure a hose or watering can reaches the bed', how: 'Most beds need about an inch of water a week, roughly 0.6 gallons per square foot.' },
];

interface Task {
  key: string;
  plantId: string;
  /** Show the one-tap "planted it" button. */
  canPlant: boolean;
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
  const plantCrop = useStore((s) => s.plantCrop);
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
        out.push({ key: `${plant.id}-h`, plantId: plant.id, canPlant: false, text: `${plant.name} is ready to harvest`, detail: 'Pick it, then log it in the Harvest tab.', tone: 'harvest' });
      }
      if (!frost || mine.every((p) => p.plantedOn)) continue;
      for (const cal of calendarsFor(plant, frost, Number(now.slice(0, 4)))) {
        const status = plantingStatus(plant, cal, now, cond);
        if (status.state === 'early' || status.state === 'past') continue;
        out.push({ key: `${plant.id}-${cal.season}`, plantId: plant.id, canPlant: ['now', 'late', 'wait-warm'].includes(status.state), text: `${plant.name}: ${status.text}`, detail: cal.why, tone: status.state === 'wait-warm' || status.state === 'soon' ? 'wait' : 'go' });
        break;
      }
    }
    return out;
  }, [plantings, frost, weather, now]);

  // What's coming up, so the off-season still has something useful to say.
  const upcoming = useMemo(() => {
    if (!frost) return [];
    const all: { name: string; date: string; indoors: boolean }[] = [];
    for (const id of new Set(plantings.filter((p) => !p.plantedOn).map((p) => p.plantId))) {
      const plant = getPlant(id);
      if (!plant) continue;
      for (const year of [Number(now.slice(0, 4)), Number(now.slice(0, 4)) + 1]) {
        for (const cal of calendarsFor(plant, frost, year)) {
          const date = cal.startIndoors?.start ?? cal.plantOut.start;
          if (date > now) all.push({ name: plant.name, date, indoors: !!cal.startIndoors });
        }
      }
    }
    const seen = new Set<string>();
    return all.sort((a, b) => (a.date < b.date ? -1 : 1)).filter((u) => !seen.has(u.name) && seen.add(u.name)).slice(0, 4);
  }, [plantings, frost, now]);

  const nudge = weather && settings.wateringNudge && inGround.length > 0 && weather.pastRainIn !== null
    ? wateringNudge(weather.pastRainIn, weather.nextRainIn ?? 0, weeklyNeedIn(plantings.filter((p) => p.plantedOn)))
    : null;
  const checklistLeft = CHECKLIST.filter((c) => !checklist[c.key]).length;
  const lastExport = useStore((s) => s.lastExport);
  const needsBackup = plantings.length > 0 && (!lastExport || now.slice(0, 7) !== lastExport.slice(0, 7));
  const minsAgo = weather ? Math.max(0, Math.round((Date.now() - weather.fetchedAt) / 60000)) : 0;
  const updated = minsAgo < 1 ? 'just now' : minsAgo < 60 ? `${minsAgo} min ago` : `${Math.round(minsAgo / 60)} h ago`;

  return (
    <div className="garden">
      <div className="scene-window" aria-hidden="true" />

      <div className="glass sky-bar">
        <p className="weather-line">
          {weather
            ? <><strong>{weather.tempF !== null ? `${weather.tempF}°F` : ''}</strong> {weather.text}{place ? ` in ${place.name}` : ''}</>
            : place ? (loading ? 'Checking the weather…' : failed ? 'Weather is unavailable, so the sky shows a clear day.' : 'Weather not loaded yet.') : 'Set your location to see your real sky.'}
          {!place && <button className="link" onClick={onGoMore}>Set location</button>}
        </p>
        {place && <p className="note updated">{weather ? `Updated ${updated}` : ''}{!loading && <button className="btn btn--small" onClick={() => void refresh()}>Refresh</button>}</p>}
        {preview && plantings.length > 0 && <p className="preview-flag">Showing your plan at full size. Nothing is marked as planted yet.</p>}
        <p className="note">Preview the garden in other weather:</p>
        <Segmented label="Preview the sky" value={choice} onChange={onChoice}
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
        <p className="glass note scene-note">When you mark crops as planted (Plan tab, "In this bed"), the scene shows them growing from seedlings on their real dates.</p>
      )}

      {/* Only warn about frost when something is actually in the ground. */}
      {alert && inGround.length > 0 && (
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
          {frost && tasks.length === 0 && <p>Nothing to plant this week.{upcoming.length > 0 ? ' Coming up:' : ''}</p>}
          {frost && tasks.length === 0 && upcoming.length > 0 && (
            <ul className="upcoming">
              {upcoming.map((u) => <li key={u.name}><strong>{fmtDate(u.date, u.date.slice(0, 4) !== now.slice(0, 4))}</strong> {u.indoors ? `Start ${u.name.toLowerCase()} seeds indoors` : `Plant ${u.name.toLowerCase()}`}</li>)}
            </ul>
          )}
          <ul className="tasks">
            {tasks.map((t) => (
              <li key={t.key} className={`task task--${t.tone}`}>
                <strong>{t.text}</strong>
                <span>{t.detail}</span>
                {t.canPlant && <button className="btn btn--small btn--primary task-btn" onClick={() => plantCrop(t.plantId, now)}>I planted it today</button>}
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

      {needsBackup && (
        <div className="glass card">
          <h2>Back up your garden</h2>
          <p>Your garden is saved only in this browser. Clearing browser data or switching phones would lose it. A backup file takes a second; Settings can load it back.</p>
          <button className="btn btn--primary" onClick={exportBackup}>Download a backup</button>
        </div>
      )}

      {checklistLeft > 0 && (
        <div className="glass card">
          <h2>Before you plant</h2>
          <ul className="checklist">
            {CHECKLIST.map((c) => (
              <li key={c.key}>
                <label className="check"><input type="checkbox" checked={!!checklist[c.key]} onChange={() => toggleChecklist(c.key)} />{c.text}</label>
                <details className="how"><summary>How?</summary><p>{c.how}</p></details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
