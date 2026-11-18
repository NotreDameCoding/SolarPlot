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
      <div className="sheet glass" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
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
  garden: <><path d="M12 20.500V11" /><path d="M12 14.500C10.800 10.600 7.600 9.300 4.600 10c.200 3.600 3.300 5.700 7.400 4.500z" /><path d="M12 11.800c.700-3.600 3.600-5.200 6.800-4.600-.200 3.300-2.900 5.500-6.800 4.600z" /><path d="M5 20.500c2.200-.900 4.500-1.200 7-1.200s4.800.300 7 1.200" /></>,
  plan: <><path d="M4.500 6.500 12 3l7.500 3.500v10L12 20.500 4.500 16.500z" /><path d="M4.500 6.500 12 10l7.500-3.500M12 10v10.500M8.250 4.750l7.500 3.500M15.750 4.750l-7.500 3.500" /></>,
  calendar: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600 7 7M17 17l1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400" /></>,
  harvest: <><path d="M4 11.500h16l-1.600 7.300a1.500 1.500 0 0 1-1.500 1.200H7.100a1.500 1.500 0 0 1-1.500-1.200z" /><path d="M8 11.500c0-3 1.800-5.500 4-5.500s4 2.500 4 5.500" /><path d="M9 15h6" /></>,
  more: <><circle cx="12" cy="12" r="3" /><path d="M12 2.500v2.300M12 19.200v2.300M2.500 12h2.300M19.200 12h2.300M5.300 5.300l1.600 1.600M17.100 17.100l1.600 1.600M5.300 18.700l1.600-1.600M17.100 6.900l1.600-1.600" /><circle cx="12" cy="12" r="6.300" /></>,
};

export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export const SUN_LABEL = { full: 'Full sun (6+ hours)', part: 'Part sun (3–6 hours)', shade: 'Shade (under 3 hours)' } as const;
