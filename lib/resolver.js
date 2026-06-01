// Resolve a Phase-1 detect() result to one of:
//   - google      Google Fonts family   → bundled metadata
//   - paid        Known commercial face → bundled foundry link
//   - system      OS / generic stack    → name passed through
//   - selfhosted  @font-face from page  → URL
//   - unknown     Anything else
//
// The resolver itself is pure. Callers pass the loaded datasets so the
// module stays trivially testable.

const SYSTEM_NAMES = new Set([
  'San Francisco', 'Segoe UI', 'Roboto', 'Cantarell',
  'System UI', 'Helvetica', 'Arial', 'Times', 'Times New Roman',
  'Courier', 'Courier New', 'Georgia',
]);

function normalize(name) {
  if (!name) return '';
  return String(name).replace(/^["']|["']$/g, '').trim();
}

function familyKey(name) {
  // Case-fold for case-insensitive lookup. Keep original key for display.
  return normalize(name).toLowerCase();
}

function buildIndex(map) {
  const out = new Map();
  for (const [k, v] of Object.entries(map || {})) {
    if (k.startsWith('_')) continue; // skip _meta etc.
    out.set(k.toLowerCase(), { key: k, ...v });
  }
  return out;
}

export function resolveFont(detect, { google = {}, paid = {} } = {}) {
  const rendered = normalize(detect?.rendered);
  if (!rendered) return { kind: 'unknown', name: '' };

  const googleIdx = buildIndex(google);
  const paidIdx   = buildIndex(paid);
  const key = familyKey(rendered);

  // 1) Google Fonts — highest priority because it's the actionable case.
  if (googleIdx.has(key)) {
    const g = googleIdx.get(key);
    const slug = encodeURIComponent(g.key).replace(/%20/g, '+');
    return {
      kind: 'google',
      name: g.key,
      category: g.c || 'sans-serif',
      weights: g.w || [400],
      specimenUrl: `https://fonts.google.com/specimen/${slug}`,
      slug,
      license: 'OFL / Apache',
    };
  }

  // 2) Paid foundry list.
  if (paidIdx.has(key)) {
    const p = paidIdx.get(key);
    return {
      kind: 'paid',
      name: p.key,
      foundry: p.foundry || 'Unknown foundry',
      url: p.url || null,
    };
  }

  // 3) System fonts (the detector tags source.type === 'system' for OS stacks,
  //    but bare names like 'Arial' also land here).
  const src = detect?.source || {};
  if (src.type === 'system' || SYSTEM_NAMES.has(rendered)) {
    return { kind: 'system', name: rendered, os: src.os || null };
  }

  // 4) Self-hosted (we have an @font-face src URL).
  if (src.url) {
    return {
      kind: 'selfhosted',
      name: rendered,
      url: src.url,
      format: src.format || null,
    };
  }

  // 5) Unknown.
  return { kind: 'unknown', name: rendered };
}
