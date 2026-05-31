// content/content.js — entry point. Wires Overlay to DOM events + messaging.

import { Overlay } from './overlay.js';

function findTextElement(start) {
  let el = start;
  while (el && el.nodeType === 1) {
    for (const child of el.childNodes) {
      if (child.nodeType === 3 && child.nodeValue && child.nodeValue.trim()) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return start;
}

function defaultMessaging() {
  const hasChrome = typeof chrome !== 'undefined' && chrome?.runtime;
  return {
    onMessage(fn) {
      if (!hasChrome) return;
      chrome.runtime.onMessage.addListener(fn);
    },
    sendMessage(msg) {
      if (!hasChrome) return;
      try { chrome.runtime.sendMessage(msg); } catch { /* SW asleep */ }
    },
  };
}

export class ContentScript {
  constructor({ detect, messaging, raf } = {}) {
    if (typeof detect !== 'function') throw new Error('ContentScript: detect required');
    this._detect = detect;
    this._messaging = messaging || defaultMessaging();
    this._raf = raf || ((fn) => requestAnimationFrame(fn));

    this.overlay = new Overlay({
      detect: this._detect,
      onEmit: (evt) => this._onOverlayEmit(evt),
    });

    this._rafPending = false;
    this._lastCursor = null;
    this._enabled = false;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick     = this._onClick.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onMessage   = this._onMessage.bind(this);
  }

  enable() {
    if (this._enabled) return;
    this.overlay.mount();
    window.addEventListener('mousemove', this._onMouseMove, true);
    window.addEventListener('click',     this._onClick,     true);
    window.addEventListener('keydown',   this._onKeyDown,   true);
    this._messaging.onMessage(this._onMessage);
    this._enabled = true;
  }

  disable() {
    if (!this._enabled) return;
    window.removeEventListener('mousemove', this._onMouseMove, true);
    window.removeEventListener('click',     this._onClick,     true);
    window.removeEventListener('keydown',   this._onKeyDown,   true);
    this.overlay.unmount();
    this._enabled = false;
  }

  _onMouseMove(ev) {
    this._lastCursor = { x: ev.clientX, y: ev.clientY };
    if (this._rafPending) return;
    this._rafPending = true;
    this._raf(() => {
      this._rafPending = false;
      const cursor = this._lastCursor;
      if (!cursor) return;
      const hit = document.elementFromPoint(cursor.x, cursor.y);
      if (!hit) return;
      if (this._isOurOwnUI(hit)) return;
      const el = findTextElement(hit);
      if (this.overlay.getMode() === 'inspect') {
        this.overlay.highlight(el);
      } else {
        this.overlay.show(el, cursor);
      }
    });
  }

  _onClick(ev) {
    if (!this._enabled) return;
    const cursor = { x: ev.clientX, y: ev.clientY };
    const hit = document.elementFromPoint(cursor.x, cursor.y) || ev.target;
    if (this._isOurOwnUI(hit)) return;
    const el = findTextElement(hit);
    this.overlay.handleClick(el, ev);
  }

  _onKeyDown(ev) {
    this.overlay.handleKey(ev);
  }

  _onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'fontlens.mode' && (msg.mode === 'hover' || msg.mode === 'inspect')) {
      this.overlay.setMode(msg.mode);
    } else if (msg.type === 'fontlens.disable') {
      this.disable();
    }
  }

  _isOurOwnUI(el) {
    if (!el) return false;
    let node = el;
    while (node) {
      if (node.tagName && node.tagName.toLowerCase() === 'fontlens-overlay') return true;
      node = node.parentNode || node.host || null;
    }
    return false;
  }

  _onOverlayEmit(evt) {
    const payload = {
      type: 'fontlens.row',
      kind: evt.kind,
      detail: evt.detail || null,
    };
    this._messaging.sendMessage(payload);
  }
}

// Auto-boot when loaded as a content script (chrome.scripting.executeScript).
// Suppressed in tests because tests instantiate ContentScript manually.
if (typeof window !== 'undefined' && typeof globalThis.__FONTLENS_TEST__ === 'undefined') {
  import('../lib/detector.js').then(({ detect }) => {
    const cs = new ContentScript({ detect });
    cs.enable();
    globalThis.__fontlens = cs;
  }).catch((err) => {
    console.error('[FontLens] failed to boot:', err);
  });
}
