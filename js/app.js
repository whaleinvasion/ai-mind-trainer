import { el, render, toast, pct, todayISO } from './ui.js';
import { store } from './storage.js';
import { adapt } from './adaptive.js';
import { aiAvailable, testKey, prefetch } from './ai.js';
import * as nback from './games/nback.js';
import * as spatial from './games/spatial.js';
import * as pairs from './games/pairs.js';
import * as shopping from './games/shopping.js';
import * as dual from './games/dualtask.js';
import * as route from './games/route.js';
import * as story from './games/story.js';

const GAMES = [story, pairs, shopping, nback, spatial, dual, route];
const byId = Object.fromEntries(GAMES.map(g => [g.meta.id, g]));

function downloadExport() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `mind-trainer-${todayISO()}.json` });
  a.click();
}

// ---------- Home ----------
function home() {
  const due = store.dueSpaced();
  const today = store.results().filter(r => new Date(r.ts).toISOString().slice(0, 10) === todayISO());
  const minutes = Math.round(today.length * 2.5);
  const diaryToday = store.diary().find(d => d.date === todayISO());
  const nodes = [];
  nodes.push(el('div', { class: 'card' },
    el('div', { class: 'row spread' },
      el('div', {}, el('h2', {}, store.settings.name ? `Привіт, ${store.settings.name}` : 'Сьогодні'), el('span', { class: 'muted' }, `${today.length} сесій · ~${minutes} хв`)),
      el('span', { class: 'badge ' + (aiAvailable() ? 'accent' : '') }, aiAvailable() ? 'AI увімкнено' : 'офлайн-режим')),
    el('div', { class: 'row', style: 'margin-top:10px' },
      el('button', { class: 'btn good', onclick: dailySession }, '▶ Щоденна сесія (15 хв)'),
      diaryToday ? el('span', { class: 'badge' }, '✓ щоденник заповнено') : el('button', { class: 'btn secondary', onclick: diary }, '📓 Щоденник'))));
  if (due.length) nodes.push(el('div', { class: 'card clickable', onclick: () => spacedScreen() },
    el('h3', {}, `⏰ Відкладені перевірки: ${due.length}`), el('p', { class: 'muted' }, 'Те, що ви вчили раніше. Саме такі повернення зміцнюють довготривалу пам\'ять.')));
  nodes.push(el('h2', {}, 'Вправи'));
  nodes.push(el('div', { class: 'grid2' }, GAMES.map(g => {
    const lvl = store.getLevel(g.meta.id, g.meta.defLevel);
    const last = store.results(g.meta.id).slice(-1)[0];
    return el('div', { class: 'card clickable', onclick: () => play(g.meta.id) },
      el('div', { class: 'row spread' }, el('span', { style: 'font-size:28px' }, g.meta.icon), el('span', { class: 'badge' }, `рівень ${lvl}`)),
      el('h3', {}, g.meta.title), el('p', { class: 'muted small' }, g.meta.desc),
      last ? el('span', { class: 'small muted' }, `останній результат: ${pct(last.accuracy)}`) : null);
  })));
  nodes.push(el('div', { class: 'row' },
    el('button', { class: 'btn secondary', onclick: progress }, '📈 Прогрес'),
    el('button', { class: 'btn secondary', onclick: diary }, '📓 Щоденник'),
    el('button', { class: 'btn secondary', onclick: aboutScreen }, 'ℹ️ Про метод')));
  render('Mind Trainer', nodes);
  // keep AI caches warm
  if (aiAvailable()) { prefetch('story', store.getLevel('story', 1), Date.now() % 1e6); prefetch('people', store.getLevel('pairs', 3), Date.now() % 1e5); }
}

// ---------- Play ----------
let queue = [];
async function play(id) {
  const g = byId[id];
  await g.start(result => {
    if (!result) { queue = []; return home(); }
    showResult(result);
  });
}
function showResult(r) {
  const g = byId[r.game];
  const a = adapt(r.game, g.meta.defLevel, r.accuracy, { max: r.max || 12 });
  store.addResult(r);
  const hist = store.results(r.game).slice(-10);
  const next = queue.shift();
  const canvas = el('canvas', { class: 'chart' });
  render('Результат',
    el('div', { class: 'card center' },
      el('div', { style: 'font-size:40px' }, g.meta.icon), el('h2', {}, g.meta.title),
      el('div', { class: 'stat ' + (r.accuracy >= 0.8 ? 'ok-text' : r.accuracy < 0.5 ? 'err' : '') }, pct(r.accuracy)),
      el('p', { class: 'muted' }, r.details),
      el('p', {}, a.changed ? (a.next > a.prev ? `Рівень підвищено: ${a.prev} → ${a.next} 🎉` : `Рівень знижено: ${a.prev} → ${a.next}. Це нормально, так працює адаптація.`) : `Рівень залишається ${a.next}`),
      canvas),
    el('div', { class: 'row' },
      next ? el('button', { class: 'btn good', onclick: () => play(next) }, `Далі: ${byId[next].meta.title} →`) : el('button', { class: 'btn', onclick: () => play(r.game) }, 'Ще раз'),
      el('button', { class: 'btn secondary', onclick: () => { queue = []; home(); } }, 'На головну')));
  requestAnimationFrame(() => drawChart(canvas, hist.map(h => h.accuracy), hist.map(h => h.level)));
}
function dailySession() {
  // A balanced 15-minute set: episodic, associative, working memory, spatial.
  const order = ['story', 'pairs', 'nback', 'shopping', 'spatial'];
  queue = order.slice(1);
  if (store.dueSpaced().length) spacedScreen(() => play(order[0]));
  else play(order[0]);
}

// ---------- Spaced recall ----------
function spacedScreen(after = home) {
  const due = store.dueSpaced();
  if (!due.length) { return after(); }
  const item = due[0];
  const selected = new Set();
  const multi = item.answer.length > 1;
  const chips = el('div', { class: 'chips' });
  const fb = el('div', { class: 'feedback' });
  const btn = el('button', { class: 'btn block', style: 'margin-top:12px' }, 'Перевірити');
  item.options.forEach(o => {
    const c = el('div', { class: 'chip' }, o);
    c.onclick = () => {
      if (!multi) { selected.clear(); chips.querySelectorAll('.chip').forEach(x => x.classList.remove('sel')); }
      if (selected.has(o)) { selected.delete(o); c.classList.remove('sel'); } else { selected.add(o); c.classList.add('sel'); }
    };
    chips.append(c);
  });
  btn.onclick = () => {
    const hits = [...selected].filter(x => item.answer.includes(x)).length;
    const fa = selected.size - hits;
    const ok = hits === item.answer.length && fa === 0;
    const partial = hits / item.answer.length >= 0.7 && fa <= 1;
    store.resolveSpaced(item.id, ok || partial);
    chips.querySelectorAll('.chip').forEach(x => { x.onclick = null; if (item.answer.includes(x.textContent)) x.classList.add('ok'); else if (selected.has(x.textContent)) x.classList.add('bad'); });
    fb.textContent = ok ? 'Чудово, пам\'ять тримає ✓' : partial ? `Майже: ${hits} з ${item.answer.length}` : `Поки що ні: ${hits} з ${item.answer.length}. Повторимо за 10 хвилин.`;
    fb.className = 'feedback ' + (ok || partial ? 'ok' : 'bad');
    btn.textContent = store.dueSpaced().length ? 'Наступна перевірка' : 'Далі';
    btn.onclick = () => spacedScreen(after);
  };
  const age = Math.round((Date.now() - item.ts) / 60000);
  const ageTxt = age < 60 ? age + ' хв' : age < 1440 ? Math.round(age / 60) + ' год' : Math.round(age / 1440) + ' дн';
  render('Відкладена перевірка',
    el('p', { class: 'muted' }, `${byId[item.game]?.meta.icon || ''} Ви бачили це ${ageTxt} тому${multi ? '. Оберіть усі пункти.' : ''}`),
    el('h2', {}, item.question), chips, fb, btn,
    el('p', { class: 'center' }, el('button', { class: 'btn secondary', onclick: () => after() }, 'Пропустити')));
}

// ---------- Diary ----------
function diary() {
  const d = store.diary().find(x => x.date === todayISO()) || { date: todayISO(), sleep: 7, exercise: 0, mood: 5, memory: 5, alcohol: 0, note: '' };
  const f = {};
  const field = (key, label, type, extra = {}) => { const i = el('input', { type, value: d[key], ...extra }); f[key] = i; return [el('label', {}, label), i]; };
  const hist = store.diary().slice(-14);
  f.mood = el('input', { type: 'range', min: 1, max: 10, value: d.mood });
  f.memory = el('input', { type: 'range', min: 1, max: 10, value: d.memory });
  f.alcohol = el('select', {}, el('option', { value: 0 }, 'Ні'), el('option', { value: 1 }, 'Так'));
  f.note = el('textarea', { rows: 2 }, d.note || '');
  render('Щоденник', el('div', { class: 'card' },
    el('h2', {}, 'Сьогодні, ' + d.date),
    field('sleep', 'Сон, годин', 'number', { step: '0.5', min: 0, max: 14 }),
    field('exercise', 'Фізична активність, хвилин', 'number', { min: 0, max: 300 }),
    el('label', {}, 'Самопочуття / настрій: 1-10'), f.mood,
    el('label', {}, 'Суб\'єктивна пам\'ять сьогодні: 1-10'), f.memory,
    el('label', {}, 'Алкоголь сьогодні'), f.alcohol,
    el('label', {}, 'Нотатка'), f.note,
    el('button', { class: 'btn block', style: 'margin-top:14px', onclick: () => {
      store.addDiary({ date: d.date, sleep: +f.sleep.value, exercise: +f.exercise.value, mood: +f.mood.value, memory: +f.memory.value, alcohol: +f.alcohol.value, note: f.note.value });
      toast('Збережено'); home();
    } }, 'Зберегти')),
    hist.length ? el('div', { class: 'card' }, el('h3', {}, 'Останні 14 днів'), el('table', {},
      el('tr', {}, ['Дата', 'Сон', 'Рух', 'Настрій', 'Пам\'ять'].map(h => el('th', {}, h))),
      hist.map(x => el('tr', {}, el('td', {}, x.date.slice(5)), el('td', {}, x.sleep), el('td', {}, x.exercise), el('td', {}, x.mood), el('td', {}, x.memory))))) : null);
  f.alcohol.value = d.alcohol;
}

// ---------- Progress ----------
function progress() {
  const nodes = [el('p', { class: 'muted' }, 'Точність за останні сесії та рівень складності. Дивіться на тренд за тижні, а не на окремі дні.')];
  for (const g of GAMES) {
    const hist = store.results(g.meta.id).slice(-30);
    if (!hist.length) continue;
    const c = el('canvas', { class: 'chart' });
    nodes.push(el('div', { class: 'card' }, el('div', { class: 'row spread' }, el('h3', {}, `${g.meta.icon} ${g.meta.title}`), el('span', { class: 'badge' }, `${hist.length} сесій · рівень ${store.getLevel(g.meta.id, g.meta.defLevel)}`)), c));
    requestAnimationFrame(() => drawChart(c, hist.map(h => h.accuracy), hist.map(h => h.level)));
  }
  const dh = store.diary().slice(-30);
  if (dh.length > 1) {
    const c = el('canvas', { class: 'chart' });
    nodes.push(el('div', { class: 'card' }, el('h3', {}, '📓 Суб\'єктивна пам\'ять і сон'), c, el('p', { class: 'muted small' }, 'Синя лінія: пам\'ять 1-10. Зелені стовпчики: сон у годинах.')));
    requestAnimationFrame(() => drawChart(c, dh.map(x => x.memory / 10), dh.map(x => x.sleep), { barMax: 12 }));
  }
  if (nodes.length === 1) nodes.push(el('div', { class: 'card center muted' }, 'Ще немає даних. Пройдіть першу сесію.'));
  nodes.push(el('div', { class: 'row' },
    el('button', { class: 'btn secondary', onclick: downloadExport }, '⬇ Експорт даних'),
    el('button', { class: 'btn secondary', onclick: home }, 'На головну')));
  render('Прогрес', nodes);
}
function drawChart(canvas, acc, levels, { barMax = 12 } = {}) {
  if (!canvas) return;
  const dpr = devicePixelRatio || 1; const W = canvas.clientWidth || 600, H = 160;
  canvas.width = W * dpr; canvas.height = H * dpr; const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const pad = 28, n = acc.length; if (!n) return;
  const x = i => pad + (n === 1 ? (W - 2 * pad) / 2 : (i / (n - 1)) * (W - 2 * pad));
  ctx.fillStyle = 'rgba(126,224,163,.35)';
  levels.forEach((l, i) => { const h = (l / barMax) * (H - 2 * pad); ctx.fillRect(x(i) - 5, H - pad - h, 10, h); });
  ctx.strokeStyle = '#5aa9ff'; ctx.lineWidth = 2.5; ctx.beginPath();
  acc.forEach((a, i) => { const y = H - pad - a * (H - 2 * pad); if (i) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y); });
  ctx.stroke();
  ctx.fillStyle = '#5aa9ff'; acc.forEach((a, i) => { ctx.beginPath(); ctx.arc(x(i), H - pad - a * (H - 2 * pad), 3.5, 0, 7); ctx.fill(); });
  ctx.fillStyle = '#9aa3b8'; ctx.font = '12px sans-serif';
  ctx.fillText('100%', 2, pad + 4); ctx.fillText('0%', 2, H - pad + 4);
  ctx.strokeStyle = 'rgba(255,179,71,.5)'; ctx.setLineDash([4, 4]); ctx.beginPath();
  const y80 = H - pad - 0.8 * (H - 2 * pad); ctx.moveTo(pad, y80); ctx.lineTo(W - pad, y80); ctx.stroke(); ctx.setLineDash([]);
}

// ---------- Settings ----------
function settings() {
  const s = store.settings;
  const key = el('input', { type: 'password', value: s.apiKey, placeholder: 'sk-ant-…', autocomplete: 'off' });
  const model = el('select', {},
    el('option', { value: 'claude-opus-5-5' }, 'claude-opus-5-5 (за замовчуванням, найкраща якість)'),
    el('option', { value: 'claude-sonnet-5-5' }, 'claude-sonnet-5-5 (дешевше)'),
    el('option', { value: 'claude-haiku-5-5' }, 'claude-haiku-5-5 (найдешевше, швидко)'));
  model.value = s.model;
  const useAI = el('input', { type: 'checkbox', style: 'width:auto' }); useAI.checked = s.useAI;
  const name = el('input', { type: 'text', value: s.name, placeholder: 'Як до вас звертатись' });
  const status = el('div', { class: 'feedback' });
  const saveSettings = () => store.setSettings({ apiKey: key.value.trim(), model: model.value, useAI: useAI.checked, name: name.value.trim() });
  render('Налаштування',
    el('div', { class: 'card' }, el('h3', {}, 'Профіль'), el('label', {}, 'Ім\'я'), name),
    el('div', { class: 'card' }, el('h3', {}, 'AI-генерація контенту'),
      el('p', { class: 'muted small' }, 'Ключ Claude API зберігається лише у вашому браузері (localStorage) і надсилається напряму на api.anthropic.com. Без ключа застосунок працює офлайн з вбудованими банками контенту.'),
      el('label', {}, 'API-ключ'), key, el('label', {}, 'Модель'), model,
      el('label', { class: 'row' }, useAI, ' Використовувати AI, коли є ключ і інтернет'),
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('button', { class: 'btn', onclick: async () => {
          saveSettings();
          status.textContent = 'Перевіряємо…'; status.className = 'feedback';
          try { await testKey(); status.textContent = 'Ключ працює ✓'; status.className = 'feedback ok'; }
          catch (e) { status.textContent = 'Помилка: ' + e.message; status.className = 'feedback bad'; }
        } }, 'Зберегти і перевірити'),
        el('button', { class: 'btn secondary', onclick: () => { saveSettings(); toast('Збережено'); home(); } }, 'Зберегти')),
      status),
    el('div', { class: 'card' }, el('h3', {}, 'Дані'),
      el('p', { class: 'muted small' }, 'Усе зберігається локально. Експортуйте резервну копію, якщо переходите на інший пристрій.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn secondary', onclick: downloadExport }, '⬇ Експорт'),
        el('button', { class: 'btn secondary', onclick: () => {
          const i = el('input', { type: 'file', accept: '.json' });
          i.onchange = () => { const r = new FileReader(); r.onload = () => { try { store.importJSON(r.result); toast('Імпортовано'); location.reload(); } catch { toast('Файл не розпізнано'); } }; r.readAsText(i.files[0]); };
          i.click();
        } }, '⬆ Імпорт'),
        el('button', { class: 'btn bad', onclick: () => { if (confirm('Видалити всі дані застосунку на цьому пристрої?')) store.reset(); } }, 'Скинути все'))));
}

function aboutScreen() {
  render('Про метод', el('div', { class: 'card' }, el('h2', {}, 'Як це працює'),
    el('p', {}, 'Кожна сесія генерується заново з випадкового зерна, тому запам\'ятати «правильні відповіді» неможливо: тренується пам\'ять, а не гра.'),
    el('p', {}, 'Складність адаптивна: 80% і вище підвищує рівень, нижче 50% знижує. Кожна вправа має свій рівень, бо перенос навички між задачами вузький.'),
    el('p', {}, '«Історія дня» і «Люди та імена» використовують Claude для реалістичних сценаріїв, наближених до життя: імена, час, місця, прохання. Саме такий матеріал краще переноситься на побут.'),
    el('p', {}, 'Відкладені перевірки повертають вивчене через 10 хвилин, годину, день і три дні. Інтервальне повторення найкраще доведений метод у психології пам\'яті.'),
    el('p', {}, 'Щоденник сну, руху і самооцінки пам\'яті дозволяє побачити зв\'язок між режимом і результатами, а експорт можна показати лікарю.'),
    el('p', { class: 'muted small' }, 'Застосунок не є медичним виробом і не замінює консультацію лікаря.'),
    el('button', { class: 'btn block', onclick: home }, 'На головну')));
}

// ---------- boot ----------
document.getElementById('btnHome').onclick = () => { queue = []; home(); };
document.getElementById('btnSettings').onclick = settings;
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
home();
