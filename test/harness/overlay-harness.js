// Manual overlay harness — boots ContentScript with the real detector but a
// no-op messaging adapter that prints to the on-page status line instead of
// firing chrome.runtime.sendMessage.

globalThis.__FONTLENS_TEST__ = true;

import { detect } from '../../lib/detector.js';
import { ContentScript } from '../../content/content.js';

await document.fonts.ready;

const emitEl = document.getElementById('emit');
const modeEl = document.getElementById('mode');

const messaging = {
  onMessage() {},
  sendMessage(msg) {
    emitEl.textContent = `${msg.kind} → ${msg.detail?.rendered ?? '—'}`;
  },
};

const cs = new ContentScript({ detect, messaging });
cs.enable();

document.getElementById('m-hover').addEventListener('click', () => {
  cs.overlay.setMode('hover');
  modeEl.textContent = 'hover';
});
document.getElementById('m-inspect').addEventListener('click', () => {
  cs.overlay.setMode('inspect');
  modeEl.textContent = 'inspect';
});
document.getElementById('disable').addEventListener('click', () => {
  cs.disable();
  modeEl.textContent = 'disabled';
});
