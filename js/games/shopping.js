// Errand list with delayed recall. Read the list, do a distraction task, then pick the items
// among distractors. Items are also scheduled for spaced recall later (10 min, 1 h, 1 day, 3 days).
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { GROCERIES, fallbackShopping } from '../content.js';
import { store } from '../storage.js';
import { aiAvailable, genShopping, prefetch } from '../ai.js';

export const meta = { id: 'shopping', title: 'Список справ', icon: '🛒', desc: 'Запам\'ятати список, відволіктись, пригадати. Повторні перевірки через час.', defLevel: 4 };

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const n = level + 1;
  const seed = newSeed(); const rng = makeRng(seed);
  render('Список справ', el('div', { class: 'card center' }, el('span', { class: 'spin' }), ' Складаємо список…'));
  let data = store.cacheTake('shopping', d => d.items.length >= n), source = data ? 'AI (кеш)' : 'офлайн';
  if (!data && aiAvailable()) { try { data = await genShopping(n, seed); source = 'AI'; } catch (e) { console.warn(e); } }
  if (!data) data = fallbackShopping(rng, n);
  data.items = data.items.slice(0, n);
  prefetch('shopping', n + 1, seed + 7);

  // Show the list
  const readMs = 2500 * n;
  const bar = el('div', { class: 'progress' }, el('div', { style: `width:100%;transition:width ${readMs}ms linear` }));
  render('Запам\'ятайте список',
    el('p', { class: 'muted' }, `Джерело: ${source}`),
    el('div', { class: 'story' }, el('p', {}, data.context + ':'), el('ol', {}, data.items.map(i => el('li', {}, i)))),
    bar, el('p', { class: 'muted center small' }, 'Порада: уявіть, як кладете кожну річ у кошик, по черзі.'));
  requestAnimationFrame(() => { bar.firstChild.style.width = '0%'; });
  await sleep(readMs);

  // Distraction: arithmetic for 25-40 s
  const distractEnd = Date.now() + 20000 + n * 2500;
  let mathOk = 0, mathN = 0;
  while (Date.now() < distractEnd) {
    const a = rng.int(3, 19), b = rng.int(2, 9), op = rng.pick(['+','-','×']);
    const ans = op === '+' ? a + b : op === '-' ? a - b : a * b;
    const opts = rng.shuffle([ans, ans + rng.int(1, 3), ans - rng.int(1, 3), ans + rng.int(4, 9)]);
    const r = await new Promise(resolve => {
      render('Відволікання', el('p', { class: 'muted center' }, 'Розв\'яжіть кілька прикладів'),
        el('div', { class: 'stimulus' }, `${a} ${op} ${b} = ?`),
        el('div', { class: 'choices' }, opts.map(o => el('div', { class: 'choice', onclick: () => resolve(o === ans) }, String(o)))));
    });
    mathN++; if (r) mathOk++;
  }

  // Recall: choose items among 2n options
  const pool = GROCERIES.filter(g => !data.items.includes(g));
  const distractors = rng.sample(pool, n);
  const opts = rng.shuffle([...data.items, ...distractors]);
  const selected = new Set();
  const result = await new Promise(resolve => {
    const chips = el('div', { class: 'chips' });
    const btn = el('button', { class: 'btn block', style: 'margin-top:14px', onclick: () => resolve([...selected]) }, 'Готово');
    opts.forEach(o => {
      const c = el('div', { class: 'chip' }, o);
      c.onclick = () => { if (selected.has(o)) { selected.delete(o); c.classList.remove('sel'); } else { selected.add(o); c.classList.add('sel'); } btn.textContent = `Готово (${selected.size} з ${n})`; };
      chips.append(c);
    });
    render('Що було у списку?', el('p', { class: 'muted' }, `${data.context}. Оберіть усі ${n} пунктів.`), chips, btn);
  });
  const hits = result.filter(x => data.items.includes(x)).length;
  const fa = result.length - hits;
  const accuracy = Math.max(0, (hits - fa) / n);

  // Schedule spaced recall of this list
  store.addSpaced({ game: meta.id, interval: 10 * 60e3, due: Date.now() + 10 * 60e3,
    question: `Пригадайте список: «${data.context}». Що там було?`, answer: data.items, options: opts });

  // Show review
  await new Promise(resolve => {
    render('Результат', el('div', { class: 'card' },
      el('p', {}, `Знайдено ${hits} з ${n}, зайвих ${fa}. Приклади: ${mathOk} з ${mathN}.`),
      el('div', { class: 'chips' }, opts.map(o => el('div', { class: 'chip ' + (data.items.includes(o) ? (result.includes(o) ? 'ok' : 'bad') : (result.includes(o) ? 'bad' : '')) }, o))),
      el('p', { class: 'muted small' }, 'Цей список з\'явиться у «Відкладених перевірках» через 10 хвилин, потім через годину і через день.'),
      el('button', { class: 'btn block', onclick: resolve }, 'Далі')));
  });
  done({ game: meta.id, level, accuracy, score: hits, seed, details: `Знайдено ${hits} з ${n}, зайвих ${fa} · ${source}` });
}
