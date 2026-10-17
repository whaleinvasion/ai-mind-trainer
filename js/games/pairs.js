// Face-name pairs: meet N people (face, name, profession, city, hobby), then answer questions.
// Content comes from Claude when available, otherwise from offline banks. Level = N people.
import { el, render, sleep } from '../ui.js';
import { makeRng, newSeed } from '../rng.js';
import { FACES, NAMES_M, NAMES_F, PROFESSIONS, CITIES, fallbackPeople } from '../content.js';
import { store } from '../storage.js';
import { aiAvailable, genPeople, prefetch } from '../ai.js';

export const meta = { id: 'pairs', title: 'Люди та імена', icon: '🧑‍🤝‍🧑', desc: 'Знайомство з людьми: запам\'ятати ім\'я, професію, місто.', defLevel: 3 };

async function getPeople(rng, n, seed) {
  let people = null, source = 'офлайн';
  const cached = store.cacheTake('people', p => p.length >= n);
  if (cached) { people = cached.slice(0, n); source = 'AI (кеш)'; }
  else if (aiAvailable()) {
    try { people = await genPeople(n, seed); source = 'AI'; } catch (e) { console.warn(e); }
  }
  if (!people) return { people: fallbackPeople(rng, n), source };
  const faces = rng.sample(FACES, n);
  return { people: people.map((p, i) => ({ ...p, face: faces[i] })), source };
}

export async function start(done) {
  const level = store.getLevel(meta.id, meta.defLevel);
  const n = level;
  const seed = newSeed(); const rng = makeRng(seed);
  render('Люди та імена', el('div', { class: 'card center' }, el('span', { class: 'spin' }), ' Готуємо людей…'));
  const { people, source } = await getPeople(rng, n, seed);
  prefetch('people', n + 1, seed + 1); // warm the cache for next time

  // Presentation phase
  const showMs = Math.max(3500, 6000 - n * 250);
  for (let i = 0; i < people.length; i++) {
    const p = people[i];
    const bar = el('div', { class: 'progress' }, el('div', { style: 'width:100%;transition:width ' + showMs + 'ms linear' }));
    render(`Знайомство ${i + 1} з ${n}`,
      el('p', { class: 'muted center' }, `Джерело: ${source}`),
      el('div', { class: 'person' }, el('div', { class: 'face' }, p.face),
        el('div', {}, el('h2', {}, p.name), el('div', {}, `${p.profession}, ${p.city}`), el('div', { class: 'muted' }, `Хобі: ${p.hobby}`))),
      bar);
    requestAnimationFrame(() => { bar.firstChild.style.width = '0%'; });
    await sleep(showMs);
  }
  // Distraction
  render('Пауза', el('div', { class: 'card center' }, el('h2', {}, 'Порахуйте від 20 до 1 подумки'), el('p', { class: 'muted' }, 'Через кілька секунд почнуться запитання')));
  await sleep(5000 + n * 500);

  // Quiz
  let correct = 0, total = 0;
  const order = rng.shuffle(people);
  for (const p of order) {
    const qs = [
      { q: 'Як звати цю людину?', a: p.name, pool: people.map(x => x.name).concat(rng.sample(NAMES_M.concat(NAMES_F), 6)) },
      { q: `Ким працює ${p.name}?`, a: p.profession, pool: people.map(x => x.profession).concat(rng.sample(PROFESSIONS, 6)) },
      { q: `З якого міста ${p.name}?`, a: p.city, pool: people.map(x => x.city).concat(rng.sample(CITIES, 6)) },
    ];
    const chosen = level >= 5 ? rng.sample(qs, 2) : [qs[0], ...(rng.chance(0.5) ? [rng.pick(qs.slice(1))] : [])];
    for (const q of chosen) {
      total++;
      const distract = rng.shuffle([...new Set(q.pool.filter(x => x !== q.a))]).slice(0, 3);
      const opts = rng.shuffle([q.a, ...distract]);
      const ok = await ask(p.face, q.q, opts, q.a);
      if (ok) correct++;
    }
  }
  done({ game: meta.id, level, accuracy: correct / total, score: correct, seed, details: `Правильно ${correct} з ${total} · ${source}` });
}

function ask(face, question, opts, answer) {
  return new Promise(resolve => {
    const fb = el('div', { class: 'feedback' });
    const choices = el('div', { class: 'choices' });
    opts.forEach(o => {
      const c = el('div', { class: 'choice' }, o);
      c.onclick = () => {
        choices.querySelectorAll('.choice').forEach(x => { x.onclick = null; if (x.textContent === answer) x.classList.add('ok'); });
        const ok = o === answer; if (!ok) c.classList.add('bad');
        fb.textContent = ok ? 'Так ✓' : `Ні. Правильно: ${answer}`; fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
        setTimeout(() => resolve(ok), ok ? 700 : 1600);
      };
      choices.append(c);
    });
    render('Запитання', el('div', { class: 'center big-emoji' }, face), el('h2', { class: 'center' }, question), choices, fb);
  });
}
