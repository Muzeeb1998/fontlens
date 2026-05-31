const SEMANTIC = new Map([
  ['h1', 'Headline'], ['h2', 'Headline'], ['h3', 'Headline'],
  ['h4', 'Headline'], ['h5', 'Headline'], ['h6', 'Headline'],
  ['p', 'Body'],
  ['small', 'Caption'], ['figcaption', 'Caption'], ['caption', 'Caption'],
  ['button', 'Label'], ['label', 'Label'],
  ['code', 'Code'], ['pre', 'Code'], ['kbd', 'Code'], ['samp', 'Code'],
]);

const ARIA = new Map([
  ['heading', 'Headline'],
  ['button',  'Label'],
]);

const NON_SEMANTIC_TAGS = new Set(['div', 'span', 'a']);

export function inferRole(el, metrics) {
  const tag = el.tagName.toLowerCase();

  if (SEMANTIC.has(tag)) return SEMANTIC.get(tag);

  const role = el.getAttribute('role');
  if (role && ARIA.has(role)) return ARIA.get(role);

  if (NON_SEMANTIC_TAGS.has(tag)) {
    const size = Number(metrics?.size) || 0;
    if (size >= 24) return 'Headline';
    if (size <= 13) return 'Caption';
    return 'Body';
  }

  return 'Body';
}
