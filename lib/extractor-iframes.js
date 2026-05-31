const MAX_DEPTH = 4;

function hostFromFrame(frame, doc) {
  const src = frame.getAttribute && frame.getAttribute('src');
  if (src) {
    try { return new URL(src, doc.location?.href || 'https://example.com/').host; }
    catch { /* fall through */ }
  }
  try {
    const h = doc.location?.host;
    if (h) return h;
  } catch { /* fall through */ }
  return '(same-origin)';
}

function safeContentDocument(frame) {
  try { return frame.contentDocument; }
  catch { return null; }
}

function walk(rootDoc, depth, out) {
  if (depth > MAX_DEPTH) return;
  const frames = rootDoc.querySelectorAll('iframe, frame');
  for (const frame of frames) {
    const cd = safeContentDocument(frame);
    if (!cd) {
      out.blockedCount++;
      continue;
    }
    const host = hostFromFrame(frame, cd);
    out.accessible.push({ doc: cd, host });
    walk(cd, depth + 1, out);
  }
}

export function collectFrames(rootDoc) {
  const out = { accessible: [], blockedCount: 0 };
  walk(rootDoc, 1, out);
  return out;
}
