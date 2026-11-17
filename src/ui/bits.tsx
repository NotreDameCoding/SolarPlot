import { useEffect, type ReactNode } from 'react';
import { getPlant } from '../engine';
import { spriteURL } from '../scene/scene.js';

/** The painted sprite for a plant, used as its icon everywhere. */
export function PlantIcon({ plantId, size = 40 }: { plantId: string; size?: number }) {
  const plant = getPlant(plantId);
  const url = plant ? spriteURL(plant.sprite) : '';
  if (!url) return <span className="plant-icon plant-icon--blank" style={{ width: size, height: size }} aria-hidden="true" />;
  return <img className="plant-icon" src={url} alt="" width={size} height={size} draggable={false} />;
}

/** A panel that slides up from the bottom on phones and sits centered on wide screens. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn btn--quiet" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'is-on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange, label, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; unit: string }) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Less ${label.toLowerCase()}`}>−</button>
      <output>{value} {unit}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>+</button>
    </div>
  );
}

const ICONS: Record<string, ReactNode> = {
  garden: <><path d="M12 21V10" /><path d="M12 14c-1-4-4-5-7-4.500 0 3.500 3 5.500 7 4.500z" /><path d="M12 11c.600-3.500 3.500-4.500 6-4 0 3-2.500 5-6 4z" /><path d="M4 21h16" /></>,
  plan: <><rect x="3.500" y="3.500" width="17" height="17" rx="2" /><path d="M3.500 9.200h17M3.500 14.800h17M9.200 3.500v17M14.800 3.500v17" /></>,
  calendar: <><rect x="3.500" y="5" width="17" height="15.500" rx="2" /><path d="M3.500 10h17M8 3v4M16 3v4" /></>,
  harvest: <><path d="M4 11h16l-1.500 8.500a1 1 0 0 1-1 .800H6.500a1 1 0 0 1-1-.800z" /><path d="M8 11l3-6M16 11l-3-6" /></>,
  more: <><circle cx="5" cy="12" r="1.400" /><circle cx="12" cy="12" r="1.400" /><circle cx="19" cy="12" r="1.400" /></>,
};

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export const SUN_LABEL = { full: 'Full sun (6+ hours)', part: 'Part sun (3–6 hours)', shade: 'Shade (under 3 hours)' } as const;
