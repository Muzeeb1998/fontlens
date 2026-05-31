const GENERICS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
  'ui-rounded', 'math', 'emoji', 'fangsong',
]);

export function isGeneric(name) {
  return GENERICS.has(String(name).toLowerCase());
}

export function parseStack(value) {
  if (!value) return [];
  const parts = [];
  let buf = '';
  let quote = null;
  for (const ch of value) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ',') { parts.push(buf); buf = ''; continue; }
    buf += ch;
  }
  parts.push(buf);
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}
