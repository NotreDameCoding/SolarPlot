import { calendarsFor, getPlant, type FrostInfo, type ISO } from '../engine';

const day = (iso: ISO) => iso.replace(/-/g, '');
const nextDay = (iso: ISO) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
};
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** An .ics calendar file with the planting windows for these plants in one year. */
export function plantingIcs(plantIds: string[], frost: FrostInfo, year: number): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SolarPlot//Planting calendar//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:SolarPlot ${year}`];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  let n = 0;
  const event = (title: string, start: ISO, end: ISO, note: string) => {
    lines.push('BEGIN:VEVENT', `UID:solarplot-${year}-${++n}-${day(start)}@solarplot`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day(start)}`, `DTEND;VALUE=DATE:${nextDay(end)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(note)}`, 'END:VEVENT');
  };
  for (const id of plantIds) {
    const plant = getPlant(id);
    if (!plant) continue;
    for (const c of calendarsFor(plant, frost, year)) {
      if (c.startIndoors) event(`Start ${plant.name.toLowerCase()} seeds indoors`, c.startIndoors.start, c.startIndoors.end, c.why);
      event(`${c.method === 'transplant' ? 'Plant out' : 'Sow'} ${plant.name.toLowerCase()}`, c.plantOut.start, c.plantOut.end, c.why);
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
