// 1. Ask the side panel (via the SW) to enter Hover mode for this tab.
// sendMessage returns a rejecting promise when no listener exists (e.g. the
// side panel isn't open yet). Swallow both sync and async failure paths so
// the user never sees "Could not establish connection" in the extensions
// Errors panel.
try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    const p = chrome.runtime.sendMessage({ type: 'fontlens:set-mode', mode: 'hover' });
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }
} catch { /* no-op when loaded outside the extension */ }

// 2. Reveal the confirmation line the first time the overlay reports an
//    amber-dot render. The overlay posts this message to the page window
//    whenever its fallback chip renders.
const confirmation = document.getElementById('confirmation');
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (!e.data || e.data.type !== 'fontlens:fallback-seen') return;
  if (!confirmation || !confirmation.hidden) return;
  confirmation.hidden = false;
});

// 3. Exit button closes the demo tab (or window if loaded outside the extension).
const exitButton = document.getElementById('exit-button');
exitButton.addEventListener('click', async () => {
  if (typeof chrome !== 'undefined' && chrome.tabs?.getCurrent) {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab && tab.id != null) {
        await chrome.tabs.remove(tab.id);
        return;
      }
    } catch { /* fall through */ }
  }
  window.close();
});

// 4. Defensive: if user does nothing for 8 seconds, gently bold the instruction.
setTimeout(() => {
  const instruction = document.getElementById('instruction');
  if (instruction) instruction.style.fontWeight = '600';
}, 8000);
