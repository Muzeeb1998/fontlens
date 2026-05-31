export async function verdict(details, { storageGet, demoUrl }) {
  if (!details || details.reason !== 'install') {
    return { action: 'noop', reason: details?.reason || 'unknown' };
  }
  const already = await storageGet('fontlens.installed');
  if (already === true) {
    return { action: 'noop', reason: 'already-installed' };
  }
  return { action: 'open-demo', url: demoUrl };
}
