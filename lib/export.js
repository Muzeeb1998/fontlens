import { isGeneric } from './parse-stack.js';

function needsQuotes(family) {
  return /\s/.test(family) || /[^\x00-\x7F]/.test(family);
}

function formatFamilyList(stack) {
  return stack.map(f => needsQuotes(f) ? `"${f}"` : f).join(', ');
}

function pxNumber(value) {
  if (typeof value === 'number') return value;
  const m = String(value).match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : null;
}

// ---------------- toCSS ----------------

export function toCSS(detail) {
  const { metrics, isFallback, rendered, requested } = detail;
  const lines = [];
  lines.push(`font-family: ${formatFamilyList(requested)};`);
  lines.push(`font-weight: ${metrics.weight};`);
  lines.push(`font-size: ${metrics.size};`);
  lines.push(`line-height: ${metrics.lineHeight};`);
  lines.push(`letter-spacing: ${metrics.letterSpacing};`);
  if (metrics.transform && metrics.transform !== 'none') {
    lines.push(`text-transform: ${metrics.transform};`);
  }
  lines.push(`color: ${metrics.color.hex};`);
  if (isFallback && rendered) lines.push(`/* fallback: ${rendered} */`);
  return lines.join('\n');
}

// ---------------- toTailwind ----------------

const TW_TEXT = [
  ['text-xs', 12], ['text-sm', 14], ['text-base', 16], ['text-lg', 18],
  ['text-xl', 20], ['text-2xl', 24], ['text-3xl', 30], ['text-4xl', 36],
  ['text-5xl', 48], ['text-6xl', 60], ['text-7xl', 72], ['text-8xl', 96],
  ['text-9xl', 128],
];

const TW_WEIGHT = {
  100: 'font-thin', 200: 'font-extralight', 300: 'font-light',
  400: 'font-normal', 500: 'font-medium', 600: 'font-semibold',
  700: 'font-bold', 800: 'font-extrabold', 900: 'font-black',
};

const TW_LEADING = [
  ['leading-3', 12], ['leading-4', 16], ['leading-5', 20], ['leading-6', 24],
  ['leading-7', 28], ['leading-8', 32], ['leading-9', 36], ['leading-10', 40],
];

const TW_TRACKING = {
  '-0.05em':  'tracking-tighter',
  '-0.025em': 'tracking-tight',
  '0em':      'tracking-normal',
  '0.025em':  'tracking-wide',
  '0.05em':   'tracking-wider',
  '0.1em':    'tracking-widest',
};

function familyUtility(stack) {
  const joined = stack.join(' ').toLowerCase();
  if (/mono|courier|menlo|consolas/.test(joined)) return 'font-mono';
  if (/\bsans\b|helvetica|arial/.test(joined))    return 'font-sans';
  if (/serif|georgia|times/.test(joined))         return 'font-serif';
  return 'font-sans';
}

function nearestExact(value, table, tol = 0) {
  for (const [cls, px] of table) {
    if (Math.abs(px - value) <= tol) return cls;
  }
  return null;
}

export function toTailwindStructured(detail) {
  const { metrics, requested } = detail;
  const classes = [];
  let approximate = false;

  classes.push(familyUtility(requested));

  const w = Number(metrics.weight);
  if (TW_WEIGHT[w]) {
    classes.push(TW_WEIGHT[w]);
  } else {
    classes.push(`font-[${w}]`);
    approximate = true;
  }

  const sz = pxNumber(metrics.size);
  if (sz !== null) {
    const exact = nearestExact(sz, TW_TEXT);
    if (exact) {
      classes.push(exact);
    } else {
      classes.push(`text-[${metrics.size}]`);
      approximate = true;
    }
  }

  const lh = pxNumber(metrics.lineHeight);
  if (lh !== null) {
    const exact = nearestExact(lh, TW_LEADING, 0.5);
    if (exact) {
      classes.push(exact);
    } else {
      classes.push(`leading-[${metrics.lineHeight}]`);
      approximate = true;
    }
  } else if (metrics.lineHeight === 'normal') {
    classes.push('leading-normal');
  }

  if (metrics.letterSpacing === 'normal') {
    classes.push('tracking-normal');
  } else {
    const ls = pxNumber(metrics.letterSpacing);
    if (ls !== null && sz) {
      const emNum = ls / sz;
      const emStr = emNum.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
      const key = `${emStr || '0'}em`;
      if (TW_TRACKING[key]) {
        classes.push(TW_TRACKING[key]);
      } else {
        classes.push(`tracking-[${emStr || '0'}em]`);
        approximate = true;
      }
    } else {
      classes.push(`tracking-[${metrics.letterSpacing}]`);
      approximate = true;
    }
  }

  classes.push(`text-[${metrics.color.hex}]`);

  return { classes, approximate };
}

export function toTailwind(detail) {
  return toTailwindStructured(detail).classes.join(' ');
}

// ---------------- toToken ----------------

export function toToken(detail) {
  const { metrics, requested, isVariable, axes } = detail;
  const firstNonGeneric = requested.find(f => !isGeneric(f)) || requested[0] || '';

  const token = {
    fontFamily: firstNonGeneric,
    fontWeight: Number(metrics.weight) || metrics.weight,
    fontSize: metrics.size,
    lineHeight: metrics.lineHeight,
    letterSpacing: metrics.letterSpacing === 'normal' ? '0' : metrics.letterSpacing,
    color: metrics.color.hex,
  };

  if (metrics.transform && metrics.transform !== 'none') {
    token.textTransform = metrics.transform;
  }

  if (isVariable && axes) {
    token.axes = Object.fromEntries(
      Object.entries(axes).map(([k, v]) => [k, v.current ?? v])
    );
  }

  return token;
}
