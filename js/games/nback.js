// Dual n-back: a symbol appears in one of 9 cells. Press "Позиція" if the position equals the one
// n steps back, "Символ" if the symbol equals the one n steps back. Level = n.
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { SYMBOLS } from '../content.js';
import { store } from '../storage.js';

export const meta = { id: 'nback', title: 'N-back', icon: '🔁', desc: 'Робоча пам\'ять: збіг позиції та символу з N кроків назад.', defLevel: 1 };

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const n = level;
  const seed = newSeed(); const rng = makeRng(seed);
  const trials = 18 + n * 2;
  const syms = rng.sample(SYMBOLS, 6);
  const seq = [];
  for (let i = 0; i < trials; i++) {
    let pos = rng.int(0, 8), sym = rng.pick(syms);
    if (i >= n) { // force ~30% targets per channel
      if (rng.chance(0.3)) pos = seq[i - n].pos;
      if (rng.chance(0.3)) sym = seq[i - n].sym;
    }
    seq.push({ pos, sym });
  }
  const cells = Array.from({ length: 9 }, () => el('div', { class: 'cell' }));
  const grid = el('div', { class: 'gamegrid', style: 'grid-template-columns:repeat(3,1fr)' }, cells);
  const fb = el('div', { class: 'feedback' });
  const counter = el('span', { class: 'badge' });
  const bar = el('div', { class: 'progress' }, el('div', { style: 'width:0%' }));
  let pressedPos = false, pressedSym = false, running = true;
  const bPos = el('button', { class: 'btn big', onclick: () => { pressedPos = true; bPos.classList.add('sel'); } }, 'Позиція');
  const bSym = el('button', { class: 'btn big', onclick: () => { pressedSym = true; bSym.classList.add('sel'); } }, 'Символ');
  const onKey = e => { if (e.key === 'a' || e.key === 'ф') bPos.click(); if (e.key === 'l' || e.key === 'д') bSym.click(); };
  document.addEventListener('keydown', onKey);
  render(`N-back · N=${n}`,
    el('div', { class: 'row spread' }, el('span', { class: 'muted' }, `Натискайте, якщо збіг з ${n} ${n === 1 ? 'кроком' : 'кроками'} назад (клавіші A / L)`), counter),
    bar, grid, fb,
    el('div', { class: 'row', style: 'justify-content:center;margin-top:10px' }, bPos, bSym),
    el('p', { class: 'center' }, el('button', { class: 'btn secondary', onclick: () => { running = false; } }, 'Зупинити')));

  let hits = 0, fa = 0, misses = 0, targets = 0;
  const interval = Math.max(1800, 2800 - n * 150);
  for (let i = 0; i < seq.length && running; i++) {
    pressedPos = pressedSym = false; bPos.classList.remove('sel'); bSym.classList.remove('sel');
    counter.textContent = `${i + 1} / ${seq.length}`;
    bar.firstChild.style.width = `${(i / seq.length) * 100}%`;
    const { pos, sym } = seq[i];
    cells[pos].textContent = sym; cells[pos].classList.add('lit');
    await sleep(interval * 0.6);
    cells[pos].textContent = ''; cells[pos].classList.remove('lit');
    await sleep(interval * 0.4);
    if (i >= n) {
      const tPos = seq[i - n].pos === pos, tSym = seq[i - n].sym === sym;
      for (const [t, p] of [[tPos, pressedPos], [tSym, pressedSym]]) {
        if (t) { targets++; if (p) hits++; else misses++; } else if (p) fa++;
      }
      const okNow = (tPos === pressedPos) && (tSym === pressedSym);
      fb.textContent = okNow ? '✓' : '✗'; fb.className = 'feedback ' + (okNow ? 'ok' : 'bad');
      setTimeout(() => { fb.textContent = ''; }, 500);
    }
  }
  document.removeEventListener('keydown', onKey);
  if (!running) return done(null);
  const accuracy = targets ? Math.max(0, (hits - fa * 0.5) / targets) : 0;
  done({ game: meta.id, level, accuracy, score: hits, seed, details: `Влучень ${hits} з ${targets}, пропусків ${misses}, хибних ${fa}` });
}
