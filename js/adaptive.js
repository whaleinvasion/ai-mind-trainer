// Adaptive staircase: raise the level after strong performance, lower it after weak performance.
// Each game keeps its own level, because transfer between tasks is narrow.
import { store } from './storage.js';

export function adapt(game, def, accuracy, { up = 0.8, down = 0.5, min = 1, max = 12 } = {}) {
  const cur = store.getLevel(game, def);
  let next = cur;
  if (accuracy >= up) next = Math.min(max, cur + 1);
  else if (accuracy < down) next = Math.max(min, cur - 1);
  store.setLevel(game, next);
  return { prev: cur, next, changed: next !== cur };
}
