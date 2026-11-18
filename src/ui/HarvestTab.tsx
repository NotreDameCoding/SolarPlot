import { useState } from 'react';
import { fmtDate, fmtTotal, getPlant, harvestTotals, isISO, PLANTS, yearOf, type Harvest } from '../engine';
import { today, useStore } from '../state/store';
import { PlantIcon } from './bits';

const UNITS: { value: Harvest['unit']; label: string }[] = [
  { value: 'lb', label: 'lb' }, { value: 'oz', label: 'oz' }, { value: 'kg', label: 'kg' }, { value: 'g', label: 'g' }, { value: 'count', label: 'count' },
];

export function HarvestTab({ preset }: { preset: string | null }) {
  const harvests = useStore((s) => s.harvests);
  const plantings = useStore((s) => s.plantings);
  const add = useStore((s) => s.addHarvest);
  const remove = useStore((s) => s.removeHarvest);

  const now = today();
  const mine = [...new Set(plantings.map((p) => p.plantId))];
  const choices = [...mine.map((id) => getPlant(id)!).filter(Boolean), ...PLANTS.filter((p) => !mine.includes(p.id))];
  const [plantId, setPlantId] = useState(preset ?? choices[0]?.id ?? 'tomato');
  const [amount, setAmount] = useState('');
  const [unit, setUnitState] = useState<Harvest['unit']>(() => {
    try { return (localStorage.getItem('solarplot:unit') as Harvest['unit']) || 'lb'; } catch { return 'lb'; }
  });
  const setUnit = (u: Harvest['unit']) => { setUnitState(u); try { localStorage.setItem('solarplot:unit', u); } catch { /* ignore */ } };
  const [date, setDate] = useState(now);
  const [note, setNote] = useState('');

  const value = Number(amount);
  const ready = value > 0 && Number.isFinite(value) && isISO(date) && date <= now;
  const year = yearOf(now);
  const totals = harvestTotals(harvests, year);
  const sorted = [...harvests].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <div className="harvest">
      <form className="glass card" onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        add({ plantId, amount: value, unit, date, note: note.trim() || undefined });
        setAmount('');
        setNote('');
      }}>
        <h1>Log a harvest</h1>
        <label>Plant
          <select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            {mine.length > 0 && <optgroup label="In your bed">{choices.slice(0, mine.length).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
            <optgroup label={mine.length ? 'Other plants' : 'All plants'}>{choices.slice(mine.length).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
          </select>
        </label>
        <div className="row">
          <label className="grow">Amount<input type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
          <label>Unit
            <select value={unit} onChange={(e) => setUnit(e.target.value as Harvest['unit'])}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </label>
        </div>
        <label>Date<input type="date" value={date} max={now} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Note <span className="optional">optional</span><input type="text" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="First ripe one!" /></label>
        <button className="btn btn--primary" type="submit" disabled={!ready}>Add to log</button>
      </form>

      <section className="glass card">
        <h2>{year} so far</h2>
        {totals.length === 0 ? <p className="note">Nothing logged yet this year. Your first harvest goes here.</p> : (
          <ul className="totals">
            {totals.map((t) => <li key={t.plantId}><PlantIcon plantId={t.plantId} size={32} /><span>{getPlant(t.plantId)?.name}</span><strong>{fmtTotal(t)}</strong></li>)}
          </ul>
        )}
      </section>

      {sorted.length > 0 && (
        <section className="glass card">
          <h2>Log</h2>
          <ul className="log">
            {sorted.map((h) => (
              <li key={h.id}>
                <span className="log-date">{fmtDate(h.date, yearOf(h.date) !== year)}</span>
                <span className="grow">{getPlant(h.plantId)?.name}: {h.amount} {h.unit === 'count' ? 'picked' : h.unit}{h.note && <em> · {h.note}</em>}</span>
                <button className="btn btn--quiet" onClick={() => remove(h.id)} aria-label={`Delete ${getPlant(h.plantId)?.name} harvest from ${fmtDate(h.date)}`}>Delete</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
