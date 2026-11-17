import { useRef, useState } from 'react';
import { encodeShare, harvestsCsv } from '../engine';
import { snapshot, today, useStore } from '../state/store';
import { Segmented } from './bits';
import { FrostSummary, LocationPicker, ManualFrost } from './Location';
import { REPORT_URL } from './PlantSheet';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MoreTab() {
  const state = useStore();
  const { place, frost, garden, plantings, harvests, settings } = state;
  const [editPlace, setEditPlace] = useState(!place);
  const [manual, setManual] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  // City only: the link never carries coordinates.
  const link = `${location.origin}${location.pathname}#g=${encodeShare(garden, plantings, place?.name ?? '')}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Link copied.');
    } catch {
      setCopied('Could not copy automatically. Select the link below and copy it.');
    }
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      setImportMsg(state.importData(JSON.parse(await f.text())) ? 'Imported.' : 'That file is not a SolarPlot export.');
    } catch {
      setImportMsg('That file could not be read.');
    }
  };

  return (
    <div className="more">
      <section className="card">
        <h1>Location and frost dates</h1>
        <FrostSummary place={place} frost={frost} />
        {editPlace
          ? <LocationPicker onPicked={(p, f) => { state.setPlace(p, f); setEditPlace(false); setManual(!f); }} />
          : <div className="row row--wrap"><button className="btn" onClick={() => setEditPlace(true)}>Change location</button><button className="btn" onClick={() => setManual(!manual)}>Enter frost dates by hand</button></div>}
        {manual && <ManualFrost frost={frost} onChange={(f) => { state.setFrost(f); setManual(false); }} />}
      </section>

      <section className="card">
        <h2>Settings</h2>
        <label className="check"><input type="checkbox" checked={settings.frostAlerts} onChange={(e) => state.updateSettings({ frostAlerts: e.target.checked })} />Show frost warnings</label>
        <label className="check"><input type="checkbox" checked={settings.wateringNudge} onChange={(e) => state.updateSettings({ wateringNudge: e.target.checked })} />Show the weekly watering check</label>
        <label className="check"><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => state.updateSettings({ reduceMotion: e.target.checked })} />Reduce motion in the garden scene</label>
        <p className="note">Warnings appear in the app when you open it. Email and push alerts need accounts, which are not built yet.</p>
        <h3>Theme</h3>
        <Segmented label="Theme" value={settings.theme} onChange={(theme) => state.updateSettings({ theme })} options={[{ value: 'auto', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </section>

      <section className="card">
        <h2>Share your garden</h2>
        <p>Anyone with this link sees a read-only copy of your layout and its scene. It includes your garden's name and town, not your exact location, dates or harvests.</p>
        <button className="btn btn--primary" onClick={() => void copy()} disabled={plantings.length === 0}>Copy share link</button>
        {copied && <p className="note" role="status">{copied}</p>}
        {copied && <input type="text" readOnly value={link} aria-label="Share link" onFocus={(e) => e.target.select()} />}
        <p className="note">The link is a snapshot. Make a new one after you change the bed.</p>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p>Everything is stored in this browser only. Clearing your browser data, or switching devices, loses it, so export a backup now and then.</p>
        <div className="row row--wrap">
          <button className="btn" onClick={() => download(`solarplot-${today()}.json`, JSON.stringify(snapshot(state), null, 2), 'application/json')}>Export everything (JSON)</button>
          <button className="btn" onClick={() => download(`solarplot-harvests-${today()}.csv`, harvestsCsv(harvests), 'text/csv')} disabled={harvests.length === 0}>Export harvests (CSV)</button>
          <button className="btn" onClick={() => file.current?.click()}>Import a backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {importMsg && <p className="note" role="status">{importMsg}</p>}
        {confirmDelete ? (
          <div className="card card--alert">
            <p>This deletes your garden, harvest log and settings from this browser. It cannot be undone.</p>
            <div className="row row--wrap">
              <button className="btn btn--danger" onClick={() => { state.deleteEverything(); setConfirmDelete(false); }}>Yes, delete everything</button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>Keep my data</button>
            </div>
          </div>
        ) : <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>Delete all my data</button>}
      </section>

      <section className="card">
        <h2>About SolarPlot</h2>
        <p>SolarPlot is a free garden planner for beginners in the United States, built by a high-school student and the Notre Dame coding club. It is an early version: the planting advice is a first draft that has not yet been reviewed by a Master Gardener, so double-check dates with your local extension office.</p>
        <p>Inspired by the feeling of solarpunk films and hand-painted animation. All art is original and drawn in code.</p>
        <p>Weather: National Weather Service and Open-Meteo. Frost dates are estimated from Open-Meteo temperature records.</p>
        <p className="note">Parts of this app were written with AI assistance. The build log in the project's docs folder says which. <a href={REPORT_URL} target="_blank" rel="noreferrer">Report a problem</a></p>
      </section>
    </div>
  );
}
