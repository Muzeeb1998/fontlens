// Stable dedupe key for an (element, detected-style) pair. The extractor
// uses this to collapse "same style on N different nodes" into one row.

export function styleKey(metrics, rendered) {
  const family = rendered ?? 'unknown';
  const size   = metrics?.size ?? '';
  const weight = metrics?.weight ?? '';
  const lh     = metrics?.lineHeight ?? '';
  const ls     = metrics?.letterSpacing ?? '';
  const tr     = metrics?.transform ?? '';
  const hex    = metrics?.color?.hex ?? '';
  return `${family}|${size}|${weight}|${lh}|${ls}|${tr}|${hex}`;
}
