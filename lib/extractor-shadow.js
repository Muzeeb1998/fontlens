const MAX_DEPTH = 32;

function isCustomElement(el) {
  const tag = el.tagName;
  return typeof tag === 'string' && tag.includes('-');
}

function walk(root, depth, out) {
  if (depth > MAX_DEPTH) return;
  const els = root.querySelectorAll('*');
  for (const el of els) {
    if (el.shadowRoot && el.shadowRoot.mode === 'open') {
      out.roots.push(el.shadowRoot);
      walk(el.shadowRoot, depth + 1, out);
      continue;
    }
    if (!el.shadowRoot && isCustomElement(el) && el.__fontlensClosedShadow === true) {
      out.closedCount++;
    }
  }
}

export function collectShadowRoots(rootEl) {
  const out = { roots: [], closedCount: 0 };
  walk(rootEl, 1, out);
  return out;
}
