import { detect as defaultDetect } from './detector.js';
import { inferRole as defaultInferRole } from './roles.js';
import { styleKey } from './style-key.js';
import { collectFrames } from './extractor-iframes.js';
import { collectShadowRoots } from './extractor-shadow.js';

const DEFAULT_MAX_NODES = 5000;

function hasVisibleText(el) {
  let hasText = false;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue && child.nodeValue.trim().length > 0) {
      hasText = true;
      break;
    }
  }
  if (!hasText) return false;
  try {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return false;
    if (cs.visibility === 'hidden') return false;
  } catch { /* element belongs to a detached doc — treat as visible */ }
  return true;
}

export function extract(root, options = {}) {
  const detect = options.detect || defaultDetect;
  const inferRole = options.inferRole || defaultInferRole;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const hostname = options.hostname ?? (globalThis.location?.hostname || '');

  const seen = new Map();
  const nodeMap = options.nodeMap;
  let nextId = 1;
  let totalNodes = 0;
  let truncated = false;

  function mintId(el) {
    if (nodeMap) {
      for (const [id, e] of nodeMap) if (e === el) return id;
      const id = nextId++; nodeMap.set(id, el); return id;
    }
    return nextId++;
  }

  // Top frame + accessible iframes + open shadow roots.
  const topDoc = root.ownerDocument || root;
  const frames = collectFrames(topDoc);
  const shadows = collectShadowRoots(root);

  const roots = [{ el: root, frame: null }];
  for (const f of frames.accessible) {
    const r = f.doc.body || f.doc.documentElement;
    if (r) roots.push({ el: r, frame: f.host });
  }
  for (const sh of shadows.roots) roots.push({ el: sh, frame: null });

  outer: for (const { el: walkRoot, frame } of roots) {
    for (const el of walkRoot.querySelectorAll('*')) {
      if (totalNodes >= maxNodes) { truncated = true; break outer; }
      if (!hasVisibleText(el)) continue;
      totalNodes++;

      const d = detect(el);
      const key = styleKey(d.metrics, d.rendered);
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          role: inferRole(el, d.metrics),
          count: 0,
          nodeIds: [],
          detail: d,
          frame,
        });
      }
      const row = seen.get(key);
      row.count++;
      row.nodeIds.push(mintId(el));
    }
  }

  const rows = [...seen.values()].sort((a, b) => b.count - a.count);

  const byFamily = new Map();
  for (const row of rows) {
    const family = row.detail.rendered || 'Unknown';
    if (!byFamily.has(family)) {
      byFamily.set(family, {
        family,
        source: { type: row.detail.source.type, format: row.detail.source.format },
        isFallback: false,
        requestedFamily: undefined,
        isVariable: row.detail.isVariable,
        axes: row.detail.axes,
        rows: [],
      });
    }
    const group = byFamily.get(family);
    group.rows.push(row);
    if (row.detail.isFallback) {
      group.isFallback = true;
      const reqFirst = row.detail.requested.find(f => f && f.toLowerCase() !== family.toLowerCase());
      if (!group.requestedFamily && reqFirst) group.requestedFamily = reqFirst;
    }
  }

  const groups = [...byFamily.values()].map(g => ({
    ...g,
    rows: g.rows.slice().sort((a, b) => b.count - a.count),
  }));

  groups.sort((a, b) => Number(b.isFallback) - Number(a.isFallback));

  return {
    hostname,
    totalNodes,
    truncated,
    rows,
    groups,
    footnotes: {
      truncated,
      blockedFrames: frames.blockedCount,
      closedShadows: shadows.closedCount,
      host: hostname,
    },
  };
}
