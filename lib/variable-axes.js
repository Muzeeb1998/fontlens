function unquote(s) { return String(s || '').replace(/^["']|["']$/g, '').trim(); }

function* fontFaceBlocks(doc) {
  // Parse @font-face blocks from raw stylesheet text. We avoid relying on
  // CSSFontFaceRule.style.getPropertyValue because some environments (incl.
  // happy-dom) drop unknown/range descriptors like `font-weight: 100 900`.
  const styleEls = doc.querySelectorAll ? doc.querySelectorAll('style, link[rel="stylesheet"]') : [];
  for (const el of styleEls) {
    const text = el.textContent || '';
    if (!text) continue;
    for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = m[1];
      const desc = {};
      for (const line of body.split(';')) {
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        const k = line.slice(0, idx).trim().toLowerCase();
        const v = line.slice(idx + 1).trim();
        if (k) desc[k] = v;
      }
      yield desc;
    }
  }
}

function parseRange(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s*(?:%|deg)?\s+(-?\d+(?:\.\d+)?)\s*(?:%|deg)?$/);
  if (!m) return null;
  const min = Number(m[1]), max = Number(m[2]);
  if (Number.isNaN(min) || Number.isNaN(max) || min === max) return null;
  return { min, max };
}

function parseObliqueRange(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^oblique\s+(-?\d+(?:\.\d+)?)deg\s+(-?\d+(?:\.\d+)?)deg$/);
  if (!m) return null;
  return { min: Number(m[1]), max: Number(m[2]) };
}

function parseVariationSettings(s) {
  if (!s) return {};
  const out = {};
  for (const m of s.matchAll(/["']?([a-zA-Z0-9]{1,4})["']?\s+(-?\d+(?:\.\d+)?)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function findFontFace(family, fontFaceSet) {
  if (!fontFaceSet) return null;
  const target = family.toLowerCase();
  for (const face of fontFaceSet) {
    if (unquote(face.family).toLowerCase() === target) return face;
  }
  return null;
}

function findFontFaceDesc(family, doc) {
  const target = family.toLowerCase();
  for (const desc of fontFaceBlocks(doc)) {
    const fam = unquote(desc['font-family'] || '').toLowerCase();
    if (fam === target) return desc;
  }
  return null;
}

function parseStretchPercent(value) {
  if (!value || value === 'normal') return 100;
  const pct = String(value).match(/^(-?\d+(?:\.\d+)?)%$/);
  if (pct) return Number(pct[1]);
  const STRETCH_KEYWORDS = {
    'ultra-condensed': 50, 'extra-condensed': 62.5, 'condensed': 75,
    'semi-condensed': 87.5, 'normal': 100, 'semi-expanded': 112.5,
    'expanded': 125, 'extra-expanded': 150, 'ultra-expanded': 200,
  };
  return STRETCH_KEYWORDS[value] ?? 100;
}

function parseObliqueDegrees(value) {
  if (!value) return 0;
  const m = String(value).match(/oblique\s+(-?\d+(?:\.\d+)?)deg/);
  return m ? Number(m[1]) : 0;
}

export function detectAxes(family, fontFaceSet, doc = document, computed = {}) {
  const face = findFontFace(family, fontFaceSet);
  const desc = findFontFaceDesc(family, doc);
  if (!face && !desc) return { isVariable: false, axes: null };

  const axes = {};

  if (desc) {
    const wghtRange = parseRange(desc['font-weight']);
    if (wghtRange) {
      axes.wght = { ...wghtRange, current: Number(computed.weight) || wghtRange.min };
    }
    const wdthRange = parseRange(desc['font-stretch']);
    if (wdthRange) {
      axes.wdth = { ...wdthRange, current: parseStretchPercent(computed.stretch) };
    }
    const slntRange = parseObliqueRange(desc['font-style']);
    if (slntRange) {
      axes.slnt = { ...slntRange, current: parseObliqueDegrees(computed.style) };
    }
  }

  if (face && face.variationSettings) {
    const settings = parseVariationSettings(face.variationSettings);
    for (const [tag, value] of Object.entries(settings)) {
      if (axes[tag]) {
        axes[tag].current = value;
      } else {
        axes[tag] = { min: value, max: value, current: value };
      }
    }
  }

  const isVariable = Object.keys(axes).length > 0 &&
    Object.values(axes).some(a => a.min !== a.max);

  return { isVariable, axes: isVariable ? axes : null };
}
