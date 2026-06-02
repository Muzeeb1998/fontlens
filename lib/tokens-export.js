// Build a downloadable design-token document from an extractor payload.
// Pure: takes the panel's `payload` (groups → rows → detail) and returns
// a plain object the caller stringifies. Two shapes:
//   - 'json'     → FontLens v1 token tree (default, framework-neutral)
//   - 'tailwind' → a tailwind.config fontFamily / fontSize-friendly object
//
// Nothing here touches the DOM, chrome.*, or the network.

function num(px) {
  const m = String(px).match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : null;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---- FontLens v1 token tree -------------------------------------------------

export function toTokenDoc(payload, { generatedAt = null } = {}) {
  const fonts = (payload?.groups || []).map((g) => ({
    family: g.family,
    source: g.source?.type || 'unknown',
    format: g.source?.format || null,
    isFallback: !!g.isFallback,
    requestedFamily: g.requestedFamily || null,
    isVariable: !!g.isVariable,
    styles: (g.rows || []).map((r) => {
      const m = r.detail?.metrics || {};
      const style = {
        role: r.role,
        fontFamily: r.detail?.rendered || g.family,
        fontSize: m.size ?? null,
        fontWeight: m.weight ?? null,
        lineHeight: m.lineHeight ?? null,
        letterSpacing: m.letterSpacing === 'normal' ? '0' : (m.letterSpacing ?? null),
        textTransform: m.transform && m.transform !== 'none' ? m.transform : undefined,
        color: m.color?.hex ?? null,
        usageCount: r.count ?? null,
      };
      if (r.detail?.isVariable && r.detail.axes) {
        style.axes = Object.fromEntries(
          Object.entries(r.detail.axes).map(([k, v]) => [k, v.current ?? v]),
        );
      }
      // strip undefined for clean JSON
      return JSON.parse(JSON.stringify(style));
    }),
  }));

  return {
    $schema: 'fontlens/v1',
    site: payload?.hostname || '',
    generatedAt: generatedAt || null,
    fontCount: fonts.length,
    styleCount: fonts.reduce((n, f) => n + f.styles.length, 0),
    fonts,
  };
}

// ---- Tailwind-friendly object ----------------------------------------------
// Returns an object a dev can paste under `theme.extend` in tailwind.config.
// fontFamily keys are family slugs; fontSize keys are role+family slugs with
// the [size, { lineHeight, letterSpacing }] tuple Tailwind accepts.

export function toTailwindConfig(payload) {
  const fontFamily = {};
  const fontSize = {};

  for (const g of payload?.groups || []) {
    if (g.isFallback) continue;
    const famKey = slug(g.family);
    if (famKey && !fontFamily[famKey]) {
      const generic = g.source?.type === 'system' ? 'sans-serif' : 'sans-serif';
      fontFamily[famKey] = [g.family, generic];
    }
    for (const r of g.rows || []) {
      const m = r.detail?.metrics || {};
      if (!m.size) continue;
      const key = `${slug(r.role)}-${famKey}`.replace(/-+$/g, '');
      if (fontSize[key]) continue;
      const opts = {};
      if (m.lineHeight) {
        const lh = num(m.lineHeight), sz = num(m.size);
        opts.lineHeight = (lh != null && sz != null) ? `${(lh / sz).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}` : m.lineHeight;
      }
      if (m.letterSpacing && m.letterSpacing !== 'normal') opts.letterSpacing = m.letterSpacing;
      if (m.weight) opts.fontWeight = String(m.weight);
      fontSize[key] = [m.size, opts];
    }
  }

  return { theme: { extend: { fontFamily, fontSize } } };
}

// ---- Filename helper --------------------------------------------------------

export function tokenFilename(payload, kind = 'json') {
  const host = (payload?.hostname || 'page').replace(/[^a-z0-9.-]+/gi, '-');
  const ext = kind === 'tailwind' ? 'tailwind.json' : 'tokens.json';
  return `fontlens-${host}-${ext}`;
}
