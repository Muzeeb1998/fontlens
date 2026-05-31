// content/content.js — entry point. Wires Overlay to DOM events + messaging.

import { Overlay } from './overlay.js';

// Closed-shadow marker (Phase 5 §4): patch attachShadow so when a closed
// shadow root is created we flag its host element. extractor-shadow.js reads
// the flag to surface a footnote. Patch must run before page scripts.
(function installClosedShadowMarker() {
  if (typeof window === 'undefined') return;
  if (window.__fontlensClosedShadowMarkerInstalled) return;
  window.__fontlensClosedShadowMarkerInstalled = true;
  try {
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      const sh = orig.apply(this, arguments);
      if (init && init.mode === 'closed') this.__fontlensClosedShadow = true;
      return sh;
    };
  } catch { /* frozen prototype — closedCount stays 0, which is honest */ }
})();

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
      // sendMessage returns a Promise that rejects with
      // "Could not establish connection. Receiving end does not exist."
      // whenever no listener is currently attached (panel closed, SW asleep,
      // demo page boot-up race). All our sends are fire-and-forget, so we
      // swallow both sync throws and async rejections.
      try {
        const p = chrome.runtime.sendMessage(msg);
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch { /* no listeners */ }
    },
  };
}

const HIGHLIGHT_STYLE_ID = 'fontlens-highlight-style';
const HIGHLIGHT_CSS = `.fontlens-highlight { outline: 2px solid #f59e0b !important; outline-offset: 2px !important; }`;

function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = HIGHLIGHT_CSS;
  document.documentElement.appendChild(style);
}

export class ContentScript {
  constructor({ detect, extract, messaging, raf } = {}) {
    if (typeof detect !== 'function') throw new Error('ContentScript: detect required');
    this._detect = detect;
    this._extract = extract;
    this._messaging = messaging || defaultMessaging();
    this._raf = raf || ((fn) => requestAnimationFrame(fn));

    this.overlay = new Overlay({
      detect: this._detect,
      onEmit: (evt) => this._onOverlayEmit(evt),
    });

    this._rafPending = false;
    this._lastCursor = null;
    this._enabled = false;
    this._nodeMap = new Map();          // id → Element (for highlight messages)
    this._nodesByStyle = new Map();     // styleKey → Element[] (for axis sliders)
    this._originalAxes = new WeakMap(); // Element → original fontVariationSettings string

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onClick     = this._onClick.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
    this._onMessage   = this._onMessage.bind(this);
  }

  enable() {
    if (this._enabled) return;
    ensureHighlightStyle();
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
    switch (msg.type) {
      case 'fontlens:set-mode':
        if (msg.mode === 'hover' || msg.mode === 'inspect') {
          this.overlay.setMode(msg.mode);
          this._messaging.sendMessage({ type: 'fontlens:mode-changed', mode: msg.mode });
        }
        return;
      case 'fontlens:request-extract':
        this._sendExtractResult();
        return;
      case 'fontlens:highlight':
        this._applyHighlight(msg.nodeIds || []);
        return;
      case 'fontlens:unhighlight':
        this._clearHighlight();
        return;
      case 'fontlens:apply-axes':
        this._applyAxes(msg.styleKey, msg.values || {});
        return;
      case 'fontlens:reset-axes':
        this._resetAxes(msg.styleKey);
        return;
      case 'fontlens:disable':
        this.disable();
        return;
    }
  }

  _applyAxes(styleKey, values) {
    const list = this._nodesByStyle.get(styleKey);
    if (!list) return;
    const settings = Object.entries(values).map(([t, v]) => `"${t}" ${v}`).join(', ');
    for (const el of list) {
      if (!this._originalAxes.has(el)) {
        this._originalAxes.set(el, el.style.fontVariationSettings || '');
      }
      el.style.fontVariationSettings = settings;
    }
  }

  _resetAxes(styleKey) {
    const list = this._nodesByStyle.get(styleKey);
    if (!list) return;
    for (const el of list) {
      const orig = this._originalAxes.get(el);
      if (orig === undefined) continue;
      if (orig === '') el.style.removeProperty('font-variation-settings');
      else el.style.fontVariationSettings = orig;
      this._originalAxes.delete(el);
    }
  }

  _sendExtractResult() {
    if (!this._extract) return;
    try {
      this._nodeMap.clear();
      this._nodesByStyle.clear();
      const out = this._extract(document.body || document.documentElement, {
        nodeMap: this._nodeMap,
        hostname: location.hostname,
      });
      // Build styleKey → Element[] map so axis sliders can mutate them.
      for (const group of out.groups) {
        for (const row of group.rows) {
          const els = row.nodeIds.map(id => this._nodeMap.get(id)).filter(Boolean);
          this._nodesByStyle.set(row.key, els);
        }
      }
      this._messaging.sendMessage({
        type: 'fontlens:extract-result',
        payload: {
          hostname: out.hostname,
          totalNodes: out.totalNodes,
          truncated: out.truncated,
          groups: out.groups,
        },
      });
    } catch (e) {
      console.error('[FontLens] extract failed:', e);
    }
  }

  _applyHighlight(ids) {
    for (const id of ids) {
      const el = this._nodeMap.get(id);
      if (el && el.classList) el.classList.add('fontlens-highlight');
    }
  }

  _clearHighlight() {
    document.querySelectorAll('.fontlens-highlight').forEach(el => el.classList.remove('fontlens-highlight'));
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
    if (evt.kind === 'hover-click') {
      // Build a single-row family group for the side panel's hover-pick path.
      const detail = evt.detail;
      if (!detail) return;
      const group = {
        family: detail.rendered || 'Unknown',
        source: { type: detail.source?.type || 'unknown', format: detail.source?.format || null },
        isFallback: !!detail.isFallback,
        requestedFamily: detail.isFallback ? (detail.requested?.[0] || null) : undefined,
        isVariable: !!detail.isVariable,
        axes: detail.axes || null,
        rows: [{
          key: 'hover-pick',
          role: 'Body',
          count: 1,
          nodeIds: [],
          detail,
        }],
      };
      this._messaging.sendMessage({
        type: 'fontlens:hover-pick',
        payload: { hostname: location.hostname, group },
      });
      return;
    }
    if (evt.kind === 'inspect-click') {
      // 150ms debounce so rapid clicks coalesce to one extract (spec §11).
      if (!this._extract || !evt.target) return;
      clearTimeout(this._extractTimer);
      this._extractTimer = setTimeout(() => {
        try {
          this._nodeMap.clear();
          const out = this._extract(evt.target, {
            nodeMap: this._nodeMap,
            hostname: location.hostname,
          });
          this._messaging.sendMessage({ type: 'fontlens:extract-result', payload: out });
        } catch (e) {
          console.error('[FontLens] inspect-click extract failed:', e);
        }
      }, 150);
    }
  }
}

// Auto-boot when loaded as a content script (chrome.scripting.executeScript).
// Suppressed in tests because tests instantiate ContentScript manually.
if (typeof window !== 'undefined' && typeof globalThis.__FONTLENS_TEST__ === 'undefined') {
  Promise.all([
    import('../lib/detector.js'),
    import('../lib/extractor.js'),
  ]).then(([{ detect }, { extract }]) => {
    const cs = new ContentScript({ detect, extract });
    cs.enable();
    globalThis.__fontlens = cs;
  }).catch((err) => {
    console.error('[FontLens] failed to boot:', err);
  });
}
