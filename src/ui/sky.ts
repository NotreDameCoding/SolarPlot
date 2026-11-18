import { sceneMode, type SceneMode, type Weather } from '../engine';

export type SceneChoice = SceneMode | 'live';

/** What the sky shows: the live weather, or the gardener's own pick. */
export function skyFor(weather: Weather | null, choice: SceneChoice): SceneMode {
  return choice === 'live' ? sceneMode(weather) : choice;
}
