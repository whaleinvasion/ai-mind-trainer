// Dual task: memorize a digit sequence while reacting to shapes between digits (tap when a circle appears).
// Level = number of digits. Trains working memory under divided attention.
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { SHAPES } from '../content.js';
import { store } from '../storage.js';

export const meta = { id: 'dual', title: 'Подвійне завдання', icon: '🎯', desc: 'Запам\'ятовуйте цифри і водночас реагуйте на круг.', defLevel: 3 };

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const n = level + 1;
  const seed = newSeed(); const rng = makeRng(seed);
  const rounds = 2;
  let digitsOk = 0, reactOk = 0, reactN = 0, falseTaps = 0;
  for (let r = 0; r < rounds; r++) {
    const digits = Array.from({ length: n }, () => rng.int(0, 9));
    const stim = el('div', { class: 'stimulus' });
    const fb = el('div', { class: 'feedback' });
    let tapped = false, circleShown = false;
    const tap = el('button', { class: 'btn big block', onclick: () => { tapped = true; } }, 'КРУГ!');
    render(`Подвійне завдання · ${n} цифр`, el('p', { class: 'muted center' }, `Раунд ${r + 1} з ${rounds}. Запам\'ятайте цифри. Коли бачите ● — тисніть кнопку.`), stim, fb, tap);
    await sleep(800);
    for (let i = 0; i < digits.length; i++) {
      stim.textContent = String(digits[i]); stim.style.color = 'var(--accent)';
      await sleep(900);
      // shape interlude
      const isCircle = rng.chance(0.4);
      const shape = isCircle ? '●' : rng.pick(SHAPES.slice(1))[0];
      tapped = false; circleShown = isCircle;
      stim.textContent = shape; stim.style.color = 'var(--text)';
      await sleep(900);
      if (isCircle) { reactN++; if (tapped) reactOk++; } else if (tapped) falseTaps++;
      stim.textContent = ''; await sleep(300);
    }
    // recall digits
    const typed = await new Promise(resolve => {
      const inp = el('input', { type: 'tel', inputmode: 'numeric', placeholder: 'Цифри по порядку', autocomplete: 'off' });
      const btn = el('button', { class: 'btn block', style: 'margin-top:12px', onclick: () => resolve(inp.value.replace(/\D/g, '')) }, 'Перевірити');
      inp.onkeydown = e => { if (e.key === 'Enter') btn.click(); };
      render('Які були цифри?', el('p', { class: 'muted' }, `Введіть ${n} цифр у тому порядку, в якому вони з'являлись`), inp, btn);
      setTimeout(() => inp.focus(), 50);
    });
    const ok = typed === digits.join('');
    if (ok) digitsOk++;
    render('Раунд', el('div', { class: 'card center' }, el('h2', { class: ok ? 'ok-text' : 'err' }, ok ? 'Цифри правильні ✓' : 'Помилка ✗'), el('p', {}, `Було: ${digits.join(' ')}`), el('p', { class: 'muted' }, `Ви ввели: ${typed.split('').join(' ') || '—'}`)));
    await sleep(1800);
  }
  const reactAcc = reactN ? Math.max(0, (reactOk - falseTaps * 0.5) / reactN) : 1;
  const accuracy = 0.7 * (digitsOk / rounds) + 0.3 * reactAcc;
  done({ game: meta.id, level, accuracy, score: digitsOk, seed, details: `Цифри: ${digitsOk} з ${rounds} раундів · реакція ${reactOk} з ${reactN}, хибних ${falseTaps}` });
}
