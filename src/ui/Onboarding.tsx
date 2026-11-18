import { useState } from 'react';
import { getPlant, MAX_COLS, MAX_ROWS, starterSet, type FrostInfo, type Garden } from '../engine';
import { DEFAULT_GARDEN, useStore, type Place } from '../state/store';
import { PlantIcon, Segmented, Stepper } from './bits';
import { FrostSummary, LocationPicker, ManualFrost } from './Location';

type Goal = 'food' | 'flowers' | 'pollinators' | 'mix';

export function Onboarding({ onDone }: { onDone: (notes: string[]) => void }) {
  const finish = useStore((s) => s.finishOnboarding);
  const [step, setStep] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [frost, setFrost] = useState<FrostInfo | null>(null);
  const [garden, setGarden] = useState<Garden>({ ...DEFAULT_GARDEN });
  const [goal, setGoal] = useState<Goal>('mix');
  const patch = (p: Partial<Garden>) => setGarden((g) => ({ ...g, ...p }));

  const starter = starterSet(goal, garden.sun, garden.cols * garden.rows);
  const done = (plantIds: string[] | null) => onDone(finish({ place, frost, goal, garden }, plantIds));

  return (
    <main className="onboarding">
      <div className="glass onboarding-card">
      <header>
        <p className="wordmark">SolarPlot</p>
        <p className="steps" aria-label={`Step ${step + 1} of 3`}>{[0, 1, 2].map((i) => <span key={i} className={i <= step ? 'is-on' : ''} />)}</p>
      </header>

      {step === 0 && (
        <section>
          <h1>Where is your garden?</h1>
          <p>Your location sets your frost dates and weather. SolarPlot is for gardens in the United States for now.</p>
          <LocationPicker onPicked={(p, f) => { setPlace(p); setFrost(f); }} />
          {place && <FrostSummary place={place} frost={frost} />}
          {place && !frost && <ManualFrost frost={frost} onChange={setFrost} />}
          <div className="actions">
            <button className="btn btn--primary" onClick={() => setStep(1)} disabled={!place}>Next</button>
            {!place && <button className="btn btn--quiet" onClick={() => setStep(1)}>Skip for now</button>}
          </div>
          <p className="note">Everything you enter stays in this browser. There is no account and nothing is uploaded, apart from asking the weather services about your town.</p>
        </section>
      )}

      {step === 1 && (
        <section>
          <h1>Tell me about your bed</h1>
          <p>One tile is one square foot. Width is the side you stand at. You can change all of this later.</p>
          <Segmented label="Garden type" value={garden.type} onChange={(type) => patch({ type })} options={[{ value: 'raised', label: 'Raised bed' }, { value: 'inground', label: 'In the ground' }]} />
          <Stepper label="Width" unit="ft" value={garden.cols} min={1} max={MAX_COLS} onChange={(cols) => patch({ cols })} />
          <Stepper label="Depth" unit="ft" value={garden.rows} min={1} max={MAX_ROWS} onChange={(rows) => patch({ rows })} />
          <h2>How much sun does it get?</h2>
          <Segmented label="Sun" value={garden.sun} onChange={(sun) => patch({ sun })} options={[{ value: 'full', label: '6+ hours' }, { value: 'part', label: '3–6 hours' }, { value: 'shade', label: 'Under 3' }]} />
          <p className="note">Most people overestimate. Count the hours of direct sun on the soil, not just daylight.</p>
          <h2>Which edge faces the sun? <span className="optional">optional</span></h2>
          <Segmented label="Sunny side" value={garden.sunnySide ?? 'none'} onChange={(v) => patch({ sunnySide: v === 'none' ? null : v })}
            options={[{ value: 'none', label: 'Not sure' }, { value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} />
          <p className="note">Stand where you usually look at the bed. In most of the US the sunny side is the south side. Tall plants go on the opposite edge.</p>
          <div className="actions">
            <button className="btn btn--primary" onClick={() => setStep(2)}>Next</button>
            <button className="btn btn--quiet" onClick={() => setStep(0)}>Back</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h1>What do you want to grow?</h1>
          <Segmented label="Goal" value={goal} onChange={setGoal} options={[{ value: 'mix', label: 'A mix' }, { value: 'food', label: 'Food' }, { value: 'flowers', label: 'Flowers' }, { value: 'pollinators', label: 'Pollinators' }]} />
          <p>A starter set for a {garden.cols} × {garden.rows} ft bed with {garden.sun === 'full' ? 'full sun' : garden.sun === 'part' ? 'part sun' : 'shade'}:</p>
          <ul className="chip-list">
            {starter.map((id) => <li key={id}><PlantIcon plantId={id} size={32} />{getPlant(id)!.name}</li>)}
          </ul>
          {starter.length === 0 && <p className="note">Nothing in the launch list suits this bed yet. Start with a blank grid.</p>}
          <div className="actions">
            <button className="btn btn--primary" onClick={() => done(starter)} disabled={starter.length === 0}>Plan it for me</button>
            <button className="btn" onClick={() => done(null)}>Start with a blank grid</button>
            <button className="btn btn--quiet" onClick={() => setStep(1)}>Back</button>
          </div>
          <p className="note">Already have plants in the ground? Start blank and place them where they really are.</p>
        </section>
      )}
      </div>
    </main>
  );
}
