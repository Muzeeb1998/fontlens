// content/loader.js — classic script injected via chrome.scripting.executeScript.
// MV3 executeScript files are NOT loaded as modules, so this small loader
// dynamic-imports the real content.js (which IS a module).
(async function () {
  if (globalThis.__fontlensLoaded) return;
  globalThis.__fontlensLoaded = true;
  try {
    await import(chrome.runtime.getURL('content/content.js'));
  } catch (e) {
    console.error('[FontLens] loader failed:', e);
  }
})();
