// Claude API layer. Called directly from the browser with the user's own key (stored in localStorage).
// No server in between. If no key or the request fails, callers fall back to offline banks.
import { store } from './storage.js';

const API = 'https://api.anthropic.com/v1/messages';

export function aiAvailable() {
  const s = store.settings;
  return s.useAI && !!s.apiKey && navigator.onLine;
}

async function callJSON(system, user, schema, maxTokens = 8000) {
  const s = store.settings;
  const body = {
    model: s.model || 'claude-opus-5-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
  };
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': s.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  // Server-side fallback on a safety refusal (Opus/Fable models). Harmless for other models.
  if (/opus-5|fable|sonnet-5-5/.test(body.model)) {
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    body.fallbacks = 'default';
  }
  const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Модель відмовилась відповідати');
  if (data.stop_reason === 'max_tokens') throw new Error('Відповідь обрізана, збільште max_tokens');
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

const SYSTEM = `Ти генеруєш контент для тренажера пам'яті українською мовою. Користувач відновлює пам'ять і тренує епізодичну та робочу пам'ять на реалістичному життєвому матеріалі.
Правила: реалістичні українські імена, міста, професії, звичайні побутові ситуації. Факти мають бути конкретні й однозначні (імена, числа, час, кольори, предмети). Ніякого насильства, алкоголю, медичних тем. Кожного разу генеруй нове, не повторюй типові приклади. Відповідай лише JSON за схемою.`;

// ---------- People (face-name pairs) ----------
export async function genPeople(n, seed) {
  const schema = {
    type: 'object', additionalProperties: false, required: ['people'],
    properties: { people: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name','gender','profession','city','hobby'],
      properties: { name: { type: 'string' }, gender: { type: 'string', enum: ['m','f'] }, profession: { type: 'string' }, city: { type: 'string' }, hobby: { type: 'string' } } } } }
  };
  const r = await callJSON(SYSTEM, `Згенеруй ${n} різних вигаданих людей (ім'я, стать, професія, місто України, хобі). Імена всі різні і не схожі між собою. Варіація №${seed}.`, schema);
  return r.people.slice(0, n);
}

// ---------- Shopping / errand list ----------
export async function genShopping(n, seed) {
  const schema = {
    type: 'object', additionalProperties: false, required: ['context','items'],
    properties: { context: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } }
  };
  const r = await callJSON(SYSTEM, `Придумай коротку побутову ситуацію (одне речення, хто і навіщо просить щось купити або зробити) і список з ${n} конкретних предметів чи справ, по 1-2 слова кожен, усі різні. Варіація №${seed}.`, schema);
  return { context: r.context, items: r.items.slice(0, n) };
}

// ---------- Story of the day (episodic memory) ----------
export async function genStory(difficulty, seed) {
  const schema = {
    type: 'object', additionalProperties: false, required: ['title','text','questions'],
    properties: {
      title: { type: 'string' }, text: { type: 'string' },
      questions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['q','a','opts'],
        properties: { q: { type: 'string' }, a: { type: 'string' }, opts: { type: 'array', items: { type: 'string' } } } } }
    }
  };
  const words = 60 + difficulty * 25;
  const facts = 4 + difficulty;
  const r = await callJSON(SYSTEM,
    `Напиши реалістичну коротку історію з повсякденного життя від другої особи ("ви...") приблизно на ${words} слів. Вона має містити рівно ${facts} конкретних фактів, які треба запам'ятати: імена людей, час, місця, числа (номери, ціни, поверх), кольори, предмети, прохання. Потім склади ${facts} запитань з одною правильною відповіддю "a" та 4 варіантами "opts" (включно з правильною, правдоподібні дистрактори). Варіація №${seed}.`,
    schema, 6000);
  return r;
}

// Prefetch into cache in background so the games feel instant.
export async function prefetch(type, n, seed) {
  if (!aiAvailable()) return;
  if (store.cacheGet(type).length >= 2) return;
  try {
    let item;
    if (type === 'people') item = await genPeople(n, seed);
    else if (type === 'shopping') item = await genShopping(n, seed);
    else if (type === 'story') item = await genStory(n, seed);
    if (item) store.cachePush(type, [item]);
  } catch (e) { console.warn('prefetch failed', e); }
}

export async function testKey() {
  const r = await callJSON('Відповідай JSON.', 'Поверни {"ok": true}', { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } }, 200);
  return r.ok === true;
}
