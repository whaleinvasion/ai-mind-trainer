// Seeded PRNG (mulberry32). Every session gets a fresh seed, so content differs on each run,
// but a seed can be replayed for debugging.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sample: (arr, n) => { const s = []; const a = arr.slice(); for (let i = 0; i < n && a.length; i++) { s.push(a.splice(Math.floor(next() * a.length), 1)[0]); } return s; },
    chance: p => next() < p,
  };
}
export function newSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
