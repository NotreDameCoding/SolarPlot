import { useEffect, useState } from 'react';
import { fetchFrost } from './api/climate';
import { decodeShare, getPlant, plantCounts, type SharedGarden } from './engine';
import { today, useStore } from './state/store';
import { Icon, PlantIcon } from './ui/bits';
import { CalendarTab } from './ui/CalendarTab';
import { GardenTab } from './ui/GardenTab';
import { HarvestTab } from './ui/HarvestTab';
import { MoreTab } from './ui/MoreTab';
import { Onboarding } from './ui/Onboarding';
import { PlanTab } from './ui/PlanTab';
import { SceneView } from './ui/SceneView';
import { skyFor, type SceneChoice } from './ui/sky';
import { useWeather } from './ui/useWeather';
import { askToKeepData } from './ui/download';
import type { SceneViewName } from './scene/scene.js';

type Tab = 'garden' | 'plan' | 'calendar' | 'harvest' | 'more';
const TABS: { id: Tab; label: string; path: string }[] = [
  { id: 'garden', label: 'Garden', path: 'garden' },
  { id: 'plan', label: 'Plan', path: 'plan' },
  { id: 'calendar', label: 'Calendar', path: 'calendar' },
  { id: 'harvest', label: 'Harvest', path: 'harvest' },
  { id: 'more', label: 'Settings', path: 'settings' },
];

/** Each tab has its own address (#/plan, #/calendar...), so Back works and tabs can be linked. */
const tabFromUrl = (): Tab => TABS.find((t) => location.hash === `#/${t.path}`)?.id ?? 'garden';

const readShare = (): SharedGarden | null => (location.hash.startsWith('#g=') ? decodeShare(location.hash.slice(3)) : null);
const systemStill = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function App() {
  const onboarded = useStore((s) => s.onboarded);
  const garden = useStore((s) => s.garden);
  const plantings = useStore((s) => s.plantings);
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const place = useStore((s) => s.place);
  const wx = useWeather();
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [choice, setChoice] = useState<SceneChoice>('live');
  const [shared, setShared] = useState<SharedGarden | null>(readShare);
  const [badLink, setBadLink] = useState(() => location.hash.startsWith('#g=') && !readShare());
  const [harvestPreset, setHarvestPreset] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  // First visit and shared gardens always open on a golden day; after that the sky is live.
  const sky = shared || !onboarded ? 'clear' : skyFor(wx.weather, choice);
  const still = reduceMotion || systemStill();

  // The whole interface takes its colors from the sky in the scene.
  useEffect(() => { document.documentElement.dataset.sky = sky; }, [sky]);

  useEffect(() => {
    const onHash = () => { setShared(readShare()); setBadLink(location.hash.startsWith('#g=') && !readShare()); setTab(tabFromUrl()); };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('popstate', onHash); };
  }, []);

  useEffect(() => {
    const t = TABS.find((x) => x.id === tab)!;
    document.title = shared ? `${shared.garden.name} · SolarPlot` : !onboarded ? 'SolarPlot: plan your garden' : `${t.label} · SolarPlot`;
  }, [tab, shared, onboarded]);

  // Gardens set up before NOAA data existed keep an Open-Meteo estimate; quietly upgrade them.
  const frost = useStore((s) => s.frost);
  useEffect(() => {
    if (!place || frost?.source !== 'history') return;
    void fetchFrost(place, today()).then((f) => { if (f?.source === 'noaa') useStore.getState().setFrost(f); });
  }, [place, frost?.source]);

  const leaveShare = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setShared(null);
    setBadLink(false);
  };
  const go = (t: Tab) => {
    const path = `#/${TABS.find((x) => x.id === t)!.path}`;
    if (location.hash !== path) history.pushState(null, '', path);
    setTab(t);
    window.scrollTo(0, 0);
  };

  // The camera never moves between tabs: every tab looks at the same garden.
  const view: SceneViewName = onboarded || shared ? 'garden' : 'wide';
  const backdrop = (
    <SceneView
      garden={shared ? shared.garden : onboarded ? garden : null}
      plantings={shared ? shared.plantings : onboarded ? plantings : []}
      mode={sky} today={today()} still={still || (onboarded && !shared && tab !== 'garden')} view={view}
    />
  );
  const broken = badLink && <p className="glass banner" role="alert">That share link is broken or out of date. <button className="link" onClick={leaveShare}>Dismiss</button></p>;

  if (shared) return <>{backdrop}<ShareView shared={shared} onLeave={leaveShare} /></>;
  if (!onboarded) return <>{backdrop}{broken}<Onboarding onDone={(n) => { setNotes(n); setTab('garden'); askToKeepData(); }} /></>;

  return (
    <>
      {backdrop}
      <div className={`app app--${tab}`}>
        <header className="top glass-bar">
          <p className="wordmark">SolarPlot</p>
          {wx.weather && wx.weather.tempF !== null && (
            <p className="top-weather"><strong>{wx.weather.tempF}°</strong> {wx.weather.text}{place ? <span className="top-place"> · {place.name.split(',')[0]}</span> : null}</p>
          )}
        </header>
        <nav className="tabs glass" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <Icon name={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <main>
          {broken}
          {notes.length > 0 && (
            <div className="glass card card--caution" role="status">
              {notes.map((n) => <p key={n}>{n}</p>)}
              <button className="btn btn--quiet" onClick={() => setNotes([])}>OK</button>
            </div>
          )}
          {tab === 'garden' && <GardenTab wx={wx} choice={choice} onChoice={setChoice} sky={sky} onGoPlan={() => go('plan')} onGoMore={() => go('more')} />}
          {tab === 'plan' && <PlanTab onLogHarvest={(id) => { setHarvestPreset(id); go('harvest'); }} />}
          {tab === 'calendar' && <CalendarTab onGoMore={() => go('more')} />}
          {tab === 'harvest' && <HarvestTab key={harvestPreset ?? 'none'} preset={harvestPreset} />}
          {tab === 'more' && <MoreTab />}
        </main>
      </div>
    </>
  );
}

/** The read-only page someone sees when they open a share link. */
function ShareView({ shared, onLeave }: { shared: SharedGarden; onLeave: () => void }) {
  const { garden, plantings, city } = shared;
  const counts = [...plantCounts(garden, plantings)];
  return (
    <div className="app app--garden app--share">
      <header className="top glass-bar"><p className="wordmark">SolarPlot</p></header>
      <main>
        <div className="scene-window" aria-hidden="true" />
        <div className="glass card">
          <h1>{garden.name}</h1>
          <p className="note">A shared {garden.cols} × {garden.rows} ft {garden.type === 'raised' ? 'raised bed' : 'in-ground bed'}{city ? ` in ${city}` : ''}, shown at full size.</p>
          <ul className="count-list">
            {counts.map(([id, n]) => <li key={id}><PlantIcon plantId={id} size={28} />{n} × {getPlant(id)!.name}</li>)}
          </ul>
          {counts.length === 0 && <p className="note">This bed is empty.</p>}
          <button className="btn btn--primary" onClick={onLeave}>Plan your own garden</button>
        </div>
      </main>
    </div>
  );
}
