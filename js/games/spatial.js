// Spatial span: cells light up in sequence; reproduce the order. Level = sequence length.
// From level 6 the grid grows to 5x5, at even levels the order must be reproduced backwards.
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { store } from '../storage.js';

export const meta = { id: 'spatial', title: 'Просторова послідовність', icon: '🟦', desc: 'Запам\'ятайте порядок клітинок і повторіть його.', defLevel: 3 };

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const seed = newSeed(); const rng = makeRng(seed);
  const size = level >= 6 ? 5 : 4;
  const reverse = level >= 4 && level % 2 === 0;
  const rounds = 3;
  let correct = 0;
  for (let r = 0; r < rounds; r++) {
    const cells = Array.from({ length: size * size }, () => el('div', { class: 'cell' }));
    const grid = el('div', { class: 'gamegrid', style: `grid-template-columns:repeat(${size},1fr)` }, cells);
    const fb = el('div', { class: 'feedback' }, 'Дивіться уважно…');
    render(`Послідовність · ${level} кроків${reverse ? ' · у зворотному порядку' : ''}`,
      el('p', { class: 'muted center' }, `Раунд ${r + 1} з ${rounds}`), grid, fb);
    const seq = []; let last = -1;
    for (let i = 0; i < level; i++) { let c; do { c = rng.int(0, size * size - 1); } while (c === last); seq.push(c); last = c; }
    await sleep(700);
    for (const c of seq) { cells[c].classList.add('lit'); await sleep(Math.max(400, 750 - level * 25)); cells[c].classList.remove('lit'); await sleep(250); }
    fb.textContent = reverse ? 'Повторіть у зворотному порядку' : 'Повторіть порядок';
    const target = reverse ? seq.slice().reverse() : seq;
    const answer = await new Promise(resolve => {
      const got = [];
      cells.forEach((cell, idx) => cell.onclick = () => {
        got.push(idx); cell.classList.add('lit2'); cell.append(el('span', { class: 'num' }, got.length));
        setTimeout(() => cell.classList.remove('lit2'), 250);
        if (got.length === target.length) resolve(got);
      });
    });
    const ok = answer.every((v, i) => v === target[i]);
    if (ok) correct++;
    fb.textContent = ok ? 'Правильно ✓' : 'Помилка ✗'; fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    if (!ok) target.forEach((c, i) => { cells[c].classList.add('ok'); cells[c].innerHTML = `<span class="num">${i + 1}</span>`; });
    await sleep(ok ? 800 : 1800);
  }
  done({ game: meta.id, level, accuracy: correct / rounds, score: correct, seed, details: `Правильних раундів ${correct} з ${rounds}` });
}
