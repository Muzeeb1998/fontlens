const GOOGLE_HOSTS = ['fonts.gstatic.com', 'fonts.googleapis.com'];
const ADOBE_HOSTS  = ['use.typekit.net', 'use.fontawesome.com'];

function unquote(s) { return s.replace(/^["']|["']$/g, '').trim(); }

function readRules(sheet) {
  try { return Array.from(sheet.cssRules || []); }
  catch { return []; }
}

function* fontFaceRules(doc) {
  for (const sheet of Array.from(doc.styleSheets || [])) {
    for (const rule of readRules(sheet)) {
      if (rule.constructor.name === 'CSSFontFaceRule' || rule.type === 5) {
        yield rule;
      }
    }
  }
}

function parseSrc(srcValue, baseUrl) {
  if (!srcValue) return { url: null, format: null };
  const urlMatch = srcValue.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
  const fmtMatch = srcValue.match(/format\(\s*['"]?([^'")]+)['"]?\s*\)/);
  let url = urlMatch ? urlMatch[1] : null;
  // Resolve relative URLs against the @font-face host page so the panel
  // surfaces the page-relative absolute URL, not a chrome-extension:// URL
  // when the panel later treats it as an <a href>.
  if (url && baseUrl) {
    try { url = new URL(url, baseUrl).href; } catch { /* keep raw */ }
  }
  return {
    url,
    format: fmtMatch ? fmtMatch[1].toLowerCase() : null,
  };
}

function hostOf(url) {
  try { return new URL(url, 'https://example.com/').host; }
  catch { return ''; }
}

function classifyHost(host, url) {
  if (GOOGLE_HOSTS.includes(host)) return 'google';
  if (ADOBE_HOSTS.includes(host)) return 'adobe';
  if (url) return 'self-hosted';
  return 'unknown';
}

// Walking every stylesheet's rules on each hover is the main source of jank.
// Build a family→source map once and reuse it until the stylesheet set
// changes (cheap length signature). Stored on the document via WeakMap so
// multiple docs (iframes) don't collide.
const _indexCache = new WeakMap(); // doc → { sig, map: Map<lowerFamily, source> }

// Signature changes whenever stylesheets are added/removed or inline CSS
// text changes. styleSheets.length is the fast common case; we add the total
// inline <style> text length so swapping one rule for another (same count)
// still busts the cache. String.length is O(1), so this stays cheap.
function sheetSignature(doc) {
  let sheets = 0, textLen = 0;
  try { sheets = (doc.styleSheets && doc.styleSheets.length) || 0; } catch {}
  try {
    const els = doc.querySelectorAll ? doc.querySelectorAll('style') : [];
    for (const el of els) textLen += (el.textContent || '').length;
  } catch {}
  return `${sheets}:${textLen}`;
}

function buildSourceIndex(doc) {
  const map = new Map();
  for (const rule of fontFaceRules(doc)) {
    const ruleFamily = unquote(rule.style.getPropertyValue('font-family') || '').toLowerCase();
    if (!ruleFamily || map.has(ruleFamily)) continue; // first declaration wins
    const baseUrl = rule.parentStyleSheet?.href || doc.baseURI || null;
    const { url, format } = parseSrc(rule.style.getPropertyValue('src'), baseUrl);
    map.set(ruleFamily, { type: classifyHost(hostOf(url), url), format, url });
  }
  return map;
}

function sourceIndex(doc) {
  const sig = sheetSignature(doc);
  const hit = _indexCache.get(doc);
  if (hit && hit.sig === sig) return hit.map;
  const map = buildSourceIndex(doc);
  _indexCache.set(doc, { sig, map });
  return map;
}

export function classifySource(family, doc = document) {
  const target = String(family).toLowerCase();
  const found = sourceIndex(doc).get(target);
  return found || { type: 'system', format: null, url: null };
}
