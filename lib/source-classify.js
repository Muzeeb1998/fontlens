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

export function classifySource(family, doc = document) {
  const target = String(family).toLowerCase();
  for (const rule of fontFaceRules(doc)) {
    const ruleFamily = unquote(rule.style.getPropertyValue('font-family') || '').toLowerCase();
    if (ruleFamily !== target) continue;
    // The right base for resolving the src URL is the stylesheet that
    // contains the @font-face rule. For inline <style>, the rule has no
    // parent href — fall back to the document's own baseURI.
    const baseUrl = rule.parentStyleSheet?.href || doc.baseURI || null;
    const { url, format } = parseSrc(rule.style.getPropertyValue('src'), baseUrl);
    return { type: classifyHost(hostOf(url), url), format, url };
  }
  return { type: 'system', format: null, url: null };
}
