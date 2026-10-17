// All persistence is localStorage. No servers, no databases.
const KEY = 'mindtrainer.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
}

const state = load();
state.settings ??= { apiKey: '', model: 'claude-opus-5-5', useAI: true, name: '' };
state.levels ??= {};          // gameId -> current level
state.results ??= [];         // {game, level, score, accuracy, ts, seed}
state.spaced ??= [];          // delayed-recall items {id, game, question, answer, options, due, interval, ts}
state.diary ??= [];           // {date, sleep, exercise, mood, memory, alcohol}
state.aiCache ??= {};         // type -> [generated items]
save(state);

export const store = {
  get settings() { return state.settings; },
  setSettings(patch) { Object.assign(state.settings, patch); save(state); },

  getLevel(game, def) { return state.levels[game] ?? def; },
  setLevel(game, lvl) { state.levels[game] = lvl; save(state); },

  addResult(r) { state.results.push({ ...r, ts: Date.now() }); if (state.results.length > 2000) state.results.shift(); save(state); },
  results(game) { return game ? state.results.filter(r => r.game === game) : state.results; },

  addSpaced(item) { state.spaced.push({ id: Math.random().toString(36).slice(2), ts: Date.now(), ...item }); save(state); },
  dueSpaced() { const now = Date.now(); return state.spaced.filter(s => s.due <= now); },
  allSpaced() { return state.spaced; },
  resolveSpaced(id, correct) {
    const i = state.spaced.findIndex(s => s.id === id);
    if (i < 0) return;
    const s = state.spaced[i];
    if (correct) {
      // Spaced repetition: 10 min -> 1 h -> 1 day -> 3 days -> done
      const steps = [10 * 60e3, 60 * 60e3, 24 * 3600e3, 3 * 24 * 3600e3];
      const idx = steps.indexOf(s.interval);
      if (idx < 0 || idx >= steps.length - 1) state.spaced.splice(i, 1);
      else { s.interval = steps[idx + 1]; s.due = Date.now() + s.interval; }
    } else {
      s.interval = 10 * 60e3; s.due = Date.now() + s.interval;
    }
    save(state);
  },

  addDiary(entry) {
    const i = state.diary.findIndex(d => d.date === entry.date);
    if (i >= 0) state.diary[i] = entry; else state.diary.push(entry);
    state.diary.sort((a, b) => a.date.localeCompare(b.date));
    save(state);
  },
  diary() { return state.diary; },

  cacheGet(type) { return state.aiCache[type] || []; },
  cachePush(type, items) { state.aiCache[type] = (state.aiCache[type] || []).concat(items).slice(-60); save(state); },
  cacheTake(type, pred = () => true) {
    const a = state.aiCache[type] || []; const i = a.findIndex(pred);
    if (i < 0) return null; const [x] = a.splice(i, 1); save(state); return x;
  },

  exportJSON() { return JSON.stringify(state, null, 2); },
  importJSON(txt) { const d = JSON.parse(txt); Object.assign(state, d); save(state); },
  reset() { localStorage.removeItem(KEY); location.reload(); },
};
