const PROBE = 'mmmiiiwwWQ@gjpy 0123';
const SIZE  = '72px';
const BASELINES = ['monospace', 'serif', 'sans-serif'];
const EPSILON = 0.5;

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;
  const c = document.createElement('canvas');
  _ctx = c.getContext('2d');
  return _ctx;
}

function measure(font) {
  const c = ctx();
  c.font = font;
  return c.measureText(PROBE).width;
}

// Baseline widths never change for a given weight/style — measure each
// generic once and reuse. Keyed by `${weight}|${style}`.
const _baseCache = new Map();
function baseWidths(weight, style) {
  const key = `${weight}|${style}`;
  let arr = _baseCache.get(key);
  if (!arr) {
    arr = BASELINES.map(base => measure(`${style} ${weight} ${SIZE} ${base}`));
    _baseCache.set(key, arr);
  }
  return arr;
}

// Memoize the per-family verdict — the hot path hovers the same handful of
// families repeatedly across hundreds of elements. Canvas measureText is the
// per-call cost we're eliminating.
const _distinctCache = new Map();

export function rendersDistinctly(family, { weight = 400, style = 'normal' } = {}) {
  if (!family) return false;
  const key = `${family}|${weight}|${style}`;
  const cached = _distinctCache.get(key);
  if (cached !== undefined) return cached;

  const bases = baseWidths(weight, style);
  let distinct = false;
  for (let i = 0; i < BASELINES.length; i++) {
    const wWith = measure(`${style} ${weight} ${SIZE} "${family}", ${BASELINES[i]}`);
    if (Math.abs(wWith - bases[i]) > EPSILON) { distinct = true; break; }
  }
  _distinctCache.set(key, distinct);
  return distinct;
}

export function findRenderedFamily(stack, opts = {}) {
  for (const family of stack) {
    if (rendersDistinctly(family, opts)) return family;
  }
  return null;
}
