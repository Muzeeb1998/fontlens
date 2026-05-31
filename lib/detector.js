import { parseStack, isGeneric } from './parse-stack.js';
import { findRenderedFamily } from './render-detect.js';
import { classifySource } from './source-classify.js';

const SYSTEM_TOKENS = new Set([
  '-apple-system', 'blinkmacsystemfont', 'system-ui',
  'segoe ui', 'roboto', 'helvetica neue', 'noto sans',
]);

const OS_FRIENDLY_NAME = {
  macos:   'San Francisco',
  ios:     'San Francisco',
  windows: 'Segoe UI',
  android: 'Roboto',
  linux:   'Cantarell',
  unknown: 'System UI',
};

let _platformOverride = null;
export function __setPlatform(p) { _platformOverride = p; }

function detectOs() {
  const p = (_platformOverride ?? navigator.userAgentData?.platform ?? navigator.platform ?? '').toLowerCase();
  if (p.includes('mac'))     return 'macos';
  if (p.includes('iphone') || p.includes('ipad') || p.includes('ios')) return 'ios';
  if (p.includes('win'))     return 'windows';
  if (p.includes('android')) return 'android';
  if (p.includes('linux'))   return 'linux';
  return 'unknown';
}

function isSystemStack(stack) {
  const firstNonGeneric = stack.find(f => !isGeneric(f));
  if (!firstNonGeneric) return false;
  return SYSTEM_TOKENS.has(firstNonGeneric.toLowerCase());
}

let _renderDetector = (family, opts) => {
  try { return findRenderedFamily([family], opts); }
  catch { return null; }
};

export function __setRenderDetector(fn) {
  _renderDetector = fn || ((f, o) => {
    try { return findRenderedFamily([f], o); } catch { return null; }
  });
}

function rgbToHex(rgb) {
  const m = String(rgb).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

function readMetrics(cs) {
  return {
    size: cs.fontSize,
    weight: Number(cs.fontWeight) || cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    transform: cs.textTransform,
    color: { rgb: cs.color, hex: rgbToHex(cs.color) },
  };
}

function checkLoaded(family, cs) {
  try {
    const probe = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} "${family}"`;
    return document.fonts.check(probe);
  } catch { return false; }
}

function findRendered(stack, opts, cs) {
  let checkSaidYes = null;
  let canvasFailed = false;
  for (const family of stack) {
    if (isGeneric(family)) continue;

    const canvas = _renderDetector(family, opts);
    const checked = checkLoaded(family, cs);
    if (checkSaidYes === null && checked) checkSaidYes = family;

    if (canvas === null) {
      canvasFailed = true;
      if (checked) return { family, low: true };
      continue;
    }
    if (canvas === true || canvas === family) {
      return { family, low: !checked };
    }
    if (typeof canvas === 'string') {
      return { family: canvas, low: false };
    }
  }
  if (checkSaidYes) return { family: checkSaidYes, low: true };
  return { family: null, low: canvasFailed };
}

export function detect(el) {
  const cs = getComputedStyle(el);
  const requested = parseStack(cs.fontFamily);
  const metrics = readMetrics(cs);
  const opts = { weight: cs.fontWeight, style: cs.fontStyle };

  if (isSystemStack(requested)) {
    const os = detectOs();
    return {
      requested,
      rendered: OS_FRIENDLY_NAME[os] || 'System UI',
      isFallback: false,
      source: { type: 'system', format: null, url: null, os },
      isVariable: false,
      axes: null,
      metrics,
      confidence: 'high',
    };
  }

  const { family: rendered, low } = findRendered(requested, opts, cs);

  const firstNonGeneric = requested.find(f => !isGeneric(f)) || null;
  const isFallback = !!(rendered && firstNonGeneric && rendered !== firstNonGeneric);

  const source = rendered
    ? { ...classifySource(rendered, el.ownerDocument), os: null }
    : { type: 'system', format: null, url: null, os: detectOs() };

  return {
    requested,
    rendered,
    isFallback,
    source,
    isVariable: false,
    axes: null,
    metrics,
    confidence: low ? 'low' : 'high',
  };
}
