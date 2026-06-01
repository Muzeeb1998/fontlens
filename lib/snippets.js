// Generate ready-to-paste snippets per resolver kind.
// Pure functions. Side panel renders the buttons; clipboard write happens there.

function quoteFamily(name) {
  return /\s|[^\x00-\x7F]/.test(name) ? `"${name}"` : name;
}

function categoryFallback(category) {
  switch (category) {
    case 'serif':       return 'serif';
    case 'monospace':   return 'monospace';
    case 'display':     return 'sans-serif';
    case 'handwriting': return 'cursive';
    default:            return 'sans-serif';
  }
}

// ---------------- Google Fonts ----------------

function pickWeightsForUrl(weights) {
  if (!Array.isArray(weights) || weights.length === 0) return [400];
  // Cap at a reasonable set so the css2 URL stays short. Common picks first.
  const pref = [300, 400, 500, 600, 700];
  const fromPref = pref.filter(w => weights.includes(w));
  if (fromPref.length) return fromPref;
  return [weights[0]];
}

export function googleSnippets(meta) {
  const { name, slug, category, weights } = meta;
  const w = pickWeightsForUrl(weights).join(';');
  const url = `https://fonts.googleapis.com/css2?family=${slug}:wght@${w}&display=swap`;
  return {
    link:    `<link href="${url}" rel="stylesheet">`,
    preconnect:
      `<link rel="preconnect" href="https://fonts.googleapis.com">\n` +
      `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n` +
      `<link href="${url}" rel="stylesheet">`,
    importCss: `@import url('${url}');`,
    css:       `font-family: ${quoteFamily(name)}, ${categoryFallback(category)};`,
    specimenUrl: meta.specimenUrl,
  };
}

// ---------------- Paid / commercial ----------------

export function paidSnippets(meta) {
  // No download snippet — only the official purchase URL.
  return {
    foundry: meta.foundry,
    url: meta.url,
    css: `font-family: ${quoteFamily(meta.name)}, sans-serif; /* commercial face — license required */`,
  };
}

// ---------------- System ----------------

export function systemSnippets(meta) {
  // OS-native stack the page can use as-is.
  const stack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif';
  return {
    name: meta.name,
    os: meta.os,
    css: `font-family: ${stack};`,
  };
}

// ---------------- Self-hosted (extension detected via @font-face) --

export function selfHostedSnippets(meta) {
  const fmt = meta.format ? ` format('${meta.format}')` : '';
  return {
    url: meta.url,
    css:
      `@font-face {\n` +
      `  font-family: ${quoteFamily(meta.name)};\n` +
      `  src: url('${meta.url}')${fmt};\n` +
      `}\n` +
      `font-family: ${quoteFamily(meta.name)}, sans-serif;`,
  };
}

// ---------------- Single entry point ----------------

export function snippetsFor(resolved) {
  switch (resolved?.kind) {
    case 'google':     return { kind: 'google',     ...googleSnippets(resolved) };
    case 'paid':       return { kind: 'paid',       ...paidSnippets(resolved) };
    case 'system':     return { kind: 'system',     ...systemSnippets(resolved) };
    case 'selfhosted': return { kind: 'selfhosted', ...selfHostedSnippets(resolved) };
    default:           return { kind: 'unknown',    name: resolved?.name || '' };
  }
}
