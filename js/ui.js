export const $ = sel => document.querySelector(sel);
export const app = () => document.getElementById('app');
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
export function render(title, ...nodes) {
  document.getElementById('screenTitle').textContent = title;
  const a = app(); a.innerHTML = ''; a.append(...nodes.flat());
  window.scrollTo(0, 0);
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function toast(msg, ms = 2200) {
  const t = el('div', { class: 'toast' }, msg); document.body.append(t); setTimeout(() => t.remove(), ms);
}
export function pct(x) { return Math.round(x * 100) + '%'; }
export function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
export function todayISO() { const d = new Date(); return d.toISOString().slice(0, 10); }
