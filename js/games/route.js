// Route memory: a map with landmarks, a path is shown step by step, then hidden. Walk it again.
// Level = path length. Spatial + sequential memory with real-world flavor.
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { PLACES, PLACE_ICONS } from '../content.js';
import { store } from '../storage.js';

export const meta = { id: 'route', title: 'Маршрут', icon: '🗺️', desc: 'Запам\'ятайте дорогу по карті з орієнтирами та пройдіть її знову.', defLevel: 3 };

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const seed = newSeed(); const rng = makeRng(seed);
  const size = 5;
  const steps = level + 2;
  const rounds = 2;
  let correct = 0;
  for (let r = 0; r < rounds; r++) {
    // landmarks on ~8 cells
    const landmarkCells = rng.sample([...Array(size * size).keys()], 8);
    const places = rng.sample(PLACES, 8);
    const lm = {}; landmarkCells.forEach((c, i) => lm[c] = places[i]);
    // random self-avoiding walk
    let path;
    for (let attempt = 0; attempt < 50; attempt++) {
      path = [rng.int(0, size * size - 1)];
      while (path.length < steps) {
        const cur = path[path.length - 1], x = cur % size, y = Math.floor(cur / size);
        const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < size && b < size).map(([a, b]) => b * size + a).filter(c => !path.includes(c));
        if (!nb.length) break;
        path.push(rng.pick(nb));
      }
      if (path.length === steps) break;
    }
    const cells = Array.from({ length: size * size }, (_, i) => el('div', { class: 'cell', style: 'font-size:26px' }, lm[i] ? PLACE_ICONS[lm[i]] : ''));
    const grid = el('div', { class: 'gamegrid', style: `grid-template-columns:repeat(${size},1fr)` }, cells);
    const fb = el('div', { class: 'feedback' });
    const start = lm[path[0]] ? `від «${lm[path[0]]}»` : 'від старту';
    const end = lm[path[path.length - 1]] ? `до «${lm[path[path.length - 1]]}»` : '';
    render(`Маршрут · ${steps} кроків`, el('p', { class: 'muted center' }, `Раунд ${r + 1} з ${rounds}. Дорога ${start} ${end}`), grid, fb);
    await sleep(800);
    cells[path[0]].classList.add('lit');
    for (let i = 1; i < path.length; i++) { await sleep(Math.max(450, 800 - level * 30)); cells[path[i]].classList.add('path'); }
    await sleep(900);
    cells.forEach(c => c.classList.remove('path'));
    fb.textContent = 'Пройдіть той самий шлях, клікаючи клітинки по черзі (старт уже позначено)';
    const got = await new Promise(resolve => {
      const g = [path[0]];
      cells.forEach((cell, idx) => cell.onclick = () => {
        if (idx === path[0] && g.length === 1) return;
        g.push(idx); cell.classList.add('lit2'); cell.append(el('span', { class: 'num' }, g.length - 1));
        if (g.length === path.length) resolve(g);
      });
    });
    const ok = got.every((v, i) => v === path[i]);
    if (ok) correct++;
    fb.textContent = ok ? 'Правильно ✓' : 'Інший шлях ✗'; fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    if (!ok) { cells.forEach(c => c.classList.remove('lit2')); path.forEach((c, i) => { cells[c].classList.add('ok'); cells[c].querySelectorAll('.num').forEach(x => x.remove()); if (i) cells[c].append(el('span', { class: 'num' }, i)); }); }
    await sleep(ok ? 900 : 2200);
  }
  done({ game: meta.id, level, accuracy: correct / rounds, score: correct, seed, details: `Правильних маршрутів ${correct} з ${rounds}` });
}
