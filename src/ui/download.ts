import { snapshot, today, useStore } from '../state/store';

/** Save text as a file through the browser. */
export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a full backup and remember when, so the app can remind people who never back up. */
export function exportBackup() {
  const state = useStore.getState();
  download(`solarplot-${today()}.json`, JSON.stringify(snapshot(state), null, 2), 'application/json');
  state.markExported(today());
}

/** Ask the browser not to clear this site's storage when space runs low (helps on phones). */
export function askToKeepData() {
  try { void navigator.storage?.persist?.(); } catch { /* not supported */ }
}
