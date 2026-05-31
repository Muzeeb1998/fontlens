// Single seam between the panel and Chrome's messaging + storage APIs.
// `panel.js` imports only from this module for chrome.* — `render.js` is
// pure DOM and never touches chrome.* directly.
//
// Every function gracefully no-ops when `chrome` is undefined so the
// panel HTML can be loaded as a standalone page (for QA / Playwright /
// preview) without throwing.

const THEME_KEY = 'theme';
const hasChrome = () => typeof chrome !== 'undefined' && !!chrome?.runtime;

export async function getActiveTabId() {
  if (!hasChrome() || !chrome.tabs?.query) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ?? null;
  } catch { return null; }
}

export async function sendToContent(msg) {
  if (!hasChrome() || !chrome.tabs?.sendMessage) return;
  const tabId = await getActiveTabId();
  if (tabId == null) return;
  try { await chrome.tabs.sendMessage(tabId, msg); } catch { /* tab closed / no listener */ }
}

export function onContentMessage(handler) {
  if (!hasChrome() || !chrome.runtime.onMessage?.addListener) {
    return () => {};
  }
  const wrapped = (msg, sender) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('fontlens:')) return;
    handler(msg, sender);
  };
  chrome.runtime.onMessage.addListener(wrapped);
  return () => chrome.runtime.onMessage.removeListener(wrapped);
}

export async function loadTheme() {
  if (!hasChrome() || !chrome.storage?.local?.get) return 'auto';
  try {
    const got = await chrome.storage.local.get(THEME_KEY);
    const t = got?.[THEME_KEY];
    return (t === 'light' || t === 'dark' || t === 'auto') ? t : 'auto';
  } catch { return 'auto'; }
}

export async function saveTheme(theme) {
  if (!hasChrome() || !chrome.storage?.local?.set) return;
  try { await chrome.storage.local.set({ [THEME_KEY]: theme }); } catch {}
}
