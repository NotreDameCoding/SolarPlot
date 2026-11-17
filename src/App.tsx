import { useEffect, useState } from 'react';
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

type Tab = 'garden' | 'plan' | 'calendar' | 'harvest' | 'more';
const TABS: { id: Tab; label: string }[] = [
  { id: 'garden', label: 'Garden' }, { id: 'plan', label: 'Plan' }, { id: 'calendar', label: 'Calendar' }, { id: 'harvest', label: 'Harvest' }, { id: 'more', label: 'More' },
];

const readShare = (): SharedGarden | null => (location.hash.startsWith('#g=') ? decodeShare(location.hash.slice(3)) : null);

export function App() {
  const onboarded = useStore((s) => s.onboarded);
  const theme = useStore((s) => s.settings.theme);
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  const [tab, setTab] = useState<Tab>('garden');
  const [shared, setShared] = useState<SharedGarden | null>(readShare);
  const [badLink, setBadLink] = useState(() => location.hash.startsWith('#g=') && !readShare());
  const [harvestPreset, setHarvestPreset] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onHash = () => { setShared(readShare()); setBadLink(location.hash.startsWith('#g=') && !readShare()); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const leaveShare = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setShared(null);
    setBadLink(false);
  };

  if (shared) return <ShareView shared={shared} still={reduceMotion} onLeave={leaveShare} />;
  if (!onboarded) return (
    <>
      {badLink && <p className="banner" role="alert">That share link is broken or out of date. <button className="link" onClick={leaveShare}>Dismiss</button></p>}
      <Onboarding onDone={(n) => { setNotes(n); setTab('garden'); }} />
    </>
  );

  const go = (t: Tab) => { setTab(t); window.scrollTo(0, 0); };

  return (
    <div className="app">
      <header className="top">
        <p className="wordmark">SolarPlot</p>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              <Icon name={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main>
        {badLink && <p className="banner" role="alert">That share link is broken or out of date. <button className="link" onClick={leaveShare}>Dismiss</button></p>}
        {notes.length > 0 && (
          <div className="card card--caution" role="status">
            {notes.map((n) => <p key={n}>{n}</p>)}
            <button className="btn btn--quiet" onClick={() => setNotes([])}>OK</button>
          </div>
        )}
        {tab === 'garden' && <GardenTab onGoPlan={() => go('plan')} onGoMore={() => go('more')} />}
        {tab === 'plan' && <PlanTab onLogHarvest={(id) => { setHarvestPreset(id); go('harvest'); }} />}
        {tab === 'calendar' && <CalendarTab onGoMore={() => go('more')} />}
        {tab === 'harvest' && <HarvestTab key={harvestPreset ?? 'none'} preset={harvestPreset} />}
        {tab === 'more' && <MoreTab />}
      </main>
    </div>
  );
}

/** The read-only page someone sees when they open a share link. */
function ShareView({ shared, still, onLeave }: { shared: SharedGarden; still: boolean; onLeave: () => void }) {
  const { garden, plantings, city } = shared;
  const counts = [...plantCounts(garden, plantings)];
  return (
    <div className="app app--share">
      <header className="top"><p className="wordmark">SolarPlot</p></header>
      <main>
        <div className="scene-card">
          <SceneView garden={garden} plantings={plantings} mode="clear" today={today()} still={still} />
        </div>
        <div className="card">
          <h1>{garden.name}</h1>
          <p className="note">A shared {garden.cols} × {garden.rows} ft {garden.type === 'raised' ? 'raised bed' : 'in-ground bed'}{city ? ` in ${city}` : ''}. Shown at full size.</p>
          <ul className="count-list">
            {counts.map(([id, n]) => {
              const plant = getPlant(id)!;
              return <li key={id}><PlantIcon plantId={id} size={28} />{n} × {plant.name}</li>;
            })}
          </ul>
          {counts.length === 0 && <p className="note">This bed is empty.</p>}
          <button className="btn btn--primary" onClick={onLeave}>Plan your own garden</button>
        </div>
      </main>
    </div>
  );
}
