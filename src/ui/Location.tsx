import { useState } from 'react';
import { fetchFrost, searchPlaces } from '../api/climate';
import { describeFrost, frostFromManual, fromDayOfYear, isISO, type FrostInfo } from '../engine';
import { today, type Place } from '../state/store';

/** Search for a town or ZIP, then look up its frost dates. */
export function LocationPicker({ onPicked }: { onPicked: (place: Place, frost: FrostInfo | null) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<'search' | 'frost' | null>(null);
  const [message, setMessage] = useState('');

  const search = async () => {
    if (query.trim().length < 2) return;
    setBusy('search');
    setMessage('');
    const found = await searchPlaces(query);
    setBusy(null);
    setResults(found);
    if (found.length === 0) setMessage('No US town or ZIP code matched. Check the spelling, or check your connection.');
  };

  const pick = async (place: Place) => {
    setBusy('frost');
    setMessage(`Reading 10 years of temperatures for ${place.name}…`);
    const frost = await fetchFrost(place, today());
    setBusy(null);
    setResults(null);
    setMessage(frost ? '' : 'Could not load the temperature records. You can enter your frost dates by hand below.');
    onPicked(place, frost);
  };

  return (
    <div className="location">
      <form className="row" onSubmit={(e) => { e.preventDefault(); void search(); }}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Town or ZIP code" aria-label="Town or ZIP code" autoComplete="postal-code" />
        <button className="btn" type="submit" disabled={busy !== null}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
      </form>
      {results && results.length > 0 && (
        <ul className="pick-list">
          {results.map((p) => (
            <li key={`${p.name}${p.lat}${p.lon}`}>
              <button type="button" onClick={() => void pick(p)} disabled={busy !== null}>{p.name}</button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="note" role="status">{message}</p>}
    </div>
  );
}

/** Type in your average last and first frost dates when records are not available. */
export function ManualFrost({ frost, onChange }: { frost: FrostInfo | null; onChange: (f: FrostInfo) => void }) {
  const year = Number(today().slice(0, 4));
  const [last, setLast] = useState(frost?.lastSpring ? fromDayOfYear(year, frost.lastSpring.median) : '');
  const [first, setFirst] = useState(frost?.firstFall ? fromDayOfYear(year, frost.firstFall.median) : '');
  const ready = isISO(last) && isISO(first) && last < first;
  return (
    <form className="manual-frost" onSubmit={(e) => { e.preventDefault(); if (ready) onChange(frostFromManual(last, first, frost?.zone ?? null)); }}>
      <label>Average last spring frost<input type="date" value={last} onChange={(e) => setLast(e.target.value)} /></label>
      <label>Average first fall frost<input type="date" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
      <button className="btn" type="submit" disabled={!ready}>Use these dates</button>
      <p className="note">Not sure? Your county extension office or a neighbor who gardens will know.</p>
    </form>
  );
}

export function FrostSummary({ place, frost }: { place: Place | null; frost: FrostInfo | null }) {
  const year = Number(today().slice(0, 4));
  if (!frost) return <p className="note">{place ? `${place.name}: frost dates not set yet.` : 'No location yet, so the calendar cannot work out dates.'}</p>;
  return (
    <p className="frost-summary">
      {place && <strong>{place.name}. </strong>}
      {describeFrost(frost, year)}
      {frost.zone && ` Hardiness zone ${frost.zone}.`}
      <span className="note"> {frost.source === 'history' ? `Worked out from ${frost.years} years of temperature records (Open-Meteo), so treat it as an estimate.` : 'From the dates you entered.'}</span>
    </p>
  );
}
