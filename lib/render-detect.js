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

export function rendersDistinctly(family, { weight = 400, style = 'normal' } = {}) {
  if (!family) return false;
  for (const base of BASELINES) {
    const wWith = measure(`${style} ${weight} ${SIZE} "${family}", ${base}`);
    const wBase = measure(`${style} ${weight} ${SIZE} ${base}`);
    if (Math.abs(wWith - wBase) > EPSILON) return true;
  }
  return false;
}

export function findRenderedFamily(stack, opts = {}) {
  for (const family of stack) {
    if (rendersDistinctly(family, opts)) return family;
  }
  return null;
}
