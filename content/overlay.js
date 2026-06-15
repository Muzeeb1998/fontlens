// content/overlay.js — Shadow-DOM hover chip + inspect outline + pinned cards.
// No chrome.* references — consumers wire messaging.
//
// Interaction model (WhatFont parity):
//   • Hover  → a single floating COMPACT chip follows the cursor (preview).
//   • Click  → STAMPS a persistent, auto-expanded card at the click point.
//             Each click leaves another card; ten clicks → ten cards.
//   • Each pinned card has its own × close button; Esc clears them all.

const STYLE_CSS = `
:host { all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none; contain: layout style; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

/* ---------- floating compact chip (hover preview) ---------- */
.chip { position: absolute; top: 0; left: 0; min-width: 140px; max-width: 280px; padding: 10px 12px; background: #ffffff; color: #0f0f10; border: 1px solid #ececec; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); pointer-events: auto; user-select: none; transform: translate3d(0,0,0); will-change: transform; }
@media (prefers-color-scheme: dark) {
  .chip { background:#0e0e10; color:#f5f5f7; border-color:#26262a; box-shadow:0 8px 24px rgba(0,0,0,0.6); }
}
@media (prefers-reduced-motion: reduce) { .chip, .outline { transition: none; } }

.line1 { font-weight: 600; font-size: 13px; line-height: 18px; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.line2 { margin-top: 4px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (prefers-color-scheme: dark) { .line2 { color:#a1a1a6; } }
.fallback { margin-top: 6px; display: flex; align-items: center; gap: 6px; font-size: 11px; line-height: 16px; font-weight: 600; color: #7a4a1d; }
@media (prefers-color-scheme: dark) { .fallback { color:#f5d089; } }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; flex: 0 0 8px; }
@media (prefers-color-scheme: dark) { .dot { background:#f5b840; } }
.requested { margin-top: 2px; font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 16px; color: #6b6b6e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-color-scheme: dark) { .requested { color:#a1a1a6; } }
.lowconf { margin-top: 2px; font-size: 10px; line-height: 14px; color: #9c9ca0; font-style: italic; }
@media (prefers-color-scheme: dark) { .lowconf { color:#6b6b6e; } }

.viewmore { display: inline-block; margin-top: 8px; padding: 0; background: none; border: 0; color: #1e6fd8; font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; cursor: pointer; }
.viewmore:hover, .viewmore:focus-visible { text-decoration: underline; outline: none; }
@media (prefers-color-scheme: dark) { .viewmore { color:#5fa8ff; } }

/* ---------- pinned expanded card (stamped on click) ---------- */
.card { position: absolute; top: 0; left: 0; min-width: 280px; max-width: 340px; padding: 14px 16px; background: #ffffff; color: #0f0f10; border: 1px solid #ececec; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.20); pointer-events: auto; user-select: none; }
@media (prefers-color-scheme: dark) {
  .card { background:#0e0e10; color:#f5f5f7; border-color:#26262a; box-shadow:0 10px 30px rgba(0,0,0,0.6); }
}
.exp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid #ececec; }
@media (prefers-color-scheme: dark) { .exp-head { border-bottom-color:#26262a; } }
.exp-title { font-weight: 650; font-size: 15px; line-height: 1.25; letter-spacing: -0.01em; }
.exp-sub { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #6b6b6e; margin-top: 3px; font-variant-numeric: tabular-nums; }
@media (prefers-color-scheme: dark) { .exp-sub { color:#a1a1a6; } }
.exp-close { flex: 0 0 auto; background: none; border: 0; color: #9c9ca0; cursor: pointer; font: 400 18px/1 -apple-system; width: 24px; height: 24px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; }
.exp-close:hover, .exp-close:focus-visible { background: #f4f4f5; color: #0f0f10; outline: none; }
@media (prefers-color-scheme: dark) {
  .exp-close { color:#6b6b6e; }
  .exp-close:hover, .exp-close:focus-visible { background:#1f1f22; color:#f5f5f7; }
}
.exp-grid { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.exp-cell { min-width: 0; }
.exp-label { font: 600 9px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-transform: uppercase; letter-spacing: 0.08em; color: #9c9ca0; margin-bottom: 5px; }
@media (prefers-color-scheme: dark) { .exp-label { color:#6b6b6e; } }
.exp-value { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.3; color: #0f0f10; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-color-scheme: dark) { .exp-value { color:#f5f5f7; } }
.exp-color-swatch { display: inline-block; width: 11px; height: 11px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.12); margin-right: 7px; vertical-align: -1px; }
@media (prefers-color-scheme: dark) { .exp-color-swatch { border-color: rgba(255,255,255,0.15); } }
.exp-specimen { margin-top: 16px; padding-top: 14px; border-top: 1px solid #ececec; font-size: 22px; line-height: 1.35; letter-spacing: -0.01em; word-break: break-word; }
@media (prefers-color-scheme: dark) { .exp-specimen { border-top-color:#26262a; } }

.outline { position: absolute; top: 0; left: 0; border: 2px solid #0f0f10; border-radius: 4px; pointer-events: none; transition: transform 60ms cubic-bezier(0.2, 0, 0, 1), width 60ms cubic-bezier(0.2, 0, 0, 1), height 60ms cubic-bezier(0.2, 0, 0, 1); }
@media (prefers-color-scheme: dark) { .outline { border-color:#f5f5f7; } }
`;

export class Overlay {
  constructor({ detect, onEmit } = {}) {
    if (typeof detect !== 'function') throw new Error('Overlay: detect fn required');
    this._detect = detect;
    this._onEmit = typeof onEmit === 'function' ? onEmit : () => {};
    this._host = null;
    this._root = null;
    this._chip = null;        // floating compact preview
    this._outline = null;
    this._pins = [];          // pinned expanded cards (multiple)
    this._mode = 'hover';
    this._lastDetail = null;
  }

  mount() {
    if (this._host) return;

    const parent = document.body || document.documentElement;
    const host = document.createElement('fontlens-overlay');
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLE_CSS;
    root.appendChild(style);

    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.style.display = 'none';
    root.appendChild(chip);

    const outline = document.createElement('div');
    outline.className = 'outline';
    outline.style.display = 'none';
    root.appendChild(outline);

    parent.appendChild(host);

    this._host = host;
    this._root = root;
    this._chip = chip;
    this._outline = outline;
  }

  unmount() {
    if (!this._host) return;
    this._host.remove();
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pins = [];
    this._lastDetail = null;
  }

  // ---------- render helpers ----------

  _stripPx(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  _formatMetrics(m) {
    const size = m.size;
    const weight = String(m.weight);
    const sizePx = this._stripPx(m.size);
    const lhPx   = this._stripPx(m.lineHeight);
    const lhPart = (sizePx != null && lhPx != null)
      ? `${Math.round(lhPx)}/${Math.round(sizePx)}`
      : (m.lineHeight === 'normal' ? 'normal' : m.lineHeight);
    return `${size} · ${weight} · ${lhPart}`;
  }

  _renderChip(detail) {
    if (!this._chip) return;
    const chip = this._chip;
    chip.replaceChildren();
    chip.style.display = 'block';

    const line1 = document.createElement('div');
    line1.className = 'line1';
    line1.textContent = detail.rendered || '—';
    chip.appendChild(line1);

    const line2 = document.createElement('div');
    line2.className = 'line2';
    line2.textContent = this._formatMetrics(detail.metrics);
    chip.appendChild(line2);

    if (detail.isFallback) {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      const dot = document.createElement('span');
      dot.className = 'dot';
      fb.appendChild(dot);
      const txt = document.createElement('span');
      txt.textContent = 'fallback';
      fb.appendChild(txt);
      chip.appendChild(fb);

      const requested = detail.requested[0] || '';
      if (requested) {
        const r = document.createElement('div');
        r.className = 'requested';
        r.textContent = `requested: ${requested}`;
        chip.appendChild(r);
      }

      try { window.postMessage({ type: 'fontlens:fallback-seen' }, '*'); } catch {}
    }

    if (detail.confidence === 'low') {
      const lc = document.createElement('div');
      lc.className = 'lowconf';
      lc.textContent = "couldn't confirm rendering";
      chip.appendChild(lc);
    }

    // View more → stamp a pinned card (same as clicking the text).
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'viewmore';
    more.textContent = 'View more →';
    more.setAttribute('aria-label', 'Pin full font detail');
    more.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (this._lastDetail) this.pinCard(this._lastDetail.detail, this._lastDetail.cursor);
    });
    chip.appendChild(more);
  }

  // Build a standalone expanded card element (its own × removes just itself).
  _buildExpandedCard(detail) {
    const card = document.createElement('div');
    card.className = 'card';

    const m = detail.metrics || {};
    const family = detail.rendered || '—';
    const weight = m.weight ?? '—';
    const style  = m.style || 'normal';
    const size   = m.size ?? '—';
    const lh     = m.lineHeight ?? '—';
    const color  = m.color?.rgb || m.color?.hex || '—';
    const swatch = m.color?.hex || '#000000';

    const head = document.createElement('div');
    head.className = 'exp-head';
    const titleBox = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'exp-title';
    title.textContent = `${family} — ${weight}`;
    const sub = document.createElement('div');
    sub.className = 'exp-sub';
    sub.textContent = `${size} · ${weight} · ${style}`;
    titleBox.appendChild(title);
    titleBox.appendChild(sub);
    head.appendChild(titleBox);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'exp-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close card');
    close.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this.removePin(card);
    });
    head.appendChild(close);
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'exp-grid';
    const cells = [
      ['Family',      family,         false],
      ['Style',       style,          false],
      ['Weight',      String(weight), false],
      ['Color',       color,          swatch],
      ['Size',        size,           false],
      ['Line Height', lh,             false],
    ];
    for (const [label, value, sw] of cells) {
      const cell = document.createElement('div');
      cell.className = 'exp-cell';
      const lab = document.createElement('div');
      lab.className = 'exp-label';
      lab.textContent = label;
      const val = document.createElement('div');
      val.className = 'exp-value';
      val.title = String(value);
      if (sw) {
        const s = document.createElement('span');
        s.className = 'exp-color-swatch';
        s.style.background = sw;
        val.appendChild(s);
      }
      val.appendChild(document.createTextNode(value));
      cell.appendChild(lab);
      cell.appendChild(val);
      grid.appendChild(cell);
    }
    card.appendChild(grid);

    const spec = document.createElement('div');
    spec.className = 'exp-specimen';
    spec.textContent = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq';
    if (detail.rendered) spec.style.fontFamily = `"${detail.rendered}", sans-serif`;
    spec.style.fontWeight = String(weight);
    card.appendChild(spec);

    if (detail.isFallback) {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      const dot = document.createElement('span');
      dot.className = 'dot';
      fb.appendChild(dot);
      const txt = document.createElement('span');
      txt.textContent = `fallback — requested: ${detail.requested?.[0] || ''}`;
      fb.appendChild(txt);
      card.appendChild(fb);
    }

    return card;
  }

  // ---------- pinned cards (multi) ----------

  pinCard(detail, cursor) {
    if (!detail) return null;
    if (!this._host) this.mount();
    const card = this._buildExpandedCard(detail);
    this._root.appendChild(card);
    this._pins.push(card);
    this._positionEl(card, cursor || { x: 0, y: 0 });
    this._host.setAttribute('data-pinned', 'true');
    return card;
  }

  removePin(card) {
    const i = this._pins.indexOf(card);
    if (i >= 0) this._pins.splice(i, 1);
    if (card) card.remove();
    if (!this._pins.length) this._host?.removeAttribute('data-pinned');
  }

  clearPins() {
    for (const c of this._pins) c.remove();
    this._pins = [];
    this._host?.removeAttribute('data-pinned');
  }

  pinCount() { return this._pins.length; }

  // ---------- show / hide ----------

  show(el, cursor) {
    if (!this._host) this.mount();

    // Always follow the cursor (cheap transform) so the chip tracks smoothly.
    // Only the EXPENSIVE work (detect + re-render) is skipped when the element
    // under the cursor hasn't changed.
    const sameEl = this._lastDetail?.el === el;
    const detail = sameEl && this._lastDetail?.detail
      ? this._lastDetail.detail
      : this._detect(el);
    this._lastDetail = { detail, el, cursor };
    if (!sameEl) this._renderChip(detail);
    this._positionEl(this._chip, cursor);
  }

  // Hide the floating preview chip (cursor left the page). Pinned cards persist.
  hideIfFloating() {
    if (this._chip) this._chip.style.display = 'none';
    this._lastDetail = null; // force re-detect+reposition on next enter
  }

  hide() {
    if (this._chip) this._chip.style.display = 'none';
  }

  // ---------- positioning ----------

  _positionEl(el, cursor) {
    if (!el || !cursor) return;
    const offsetX = 14;
    const offsetY = 18;
    const rect = el.getBoundingClientRect();
    const vw = (typeof window !== 'undefined' && window.innerWidth)  || 1024;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 768;

    let x = cursor.x + offsetX;
    let y = cursor.y + offsetY;

    if (x + rect.width > vw) x = cursor.x - rect.width - offsetX;
    if (y + rect.height > vh) y = cursor.y - rect.height - offsetY;
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  move(cursor) {
    if (!this._chip || this._chip.style.display === 'none') return;
    this._positionEl(this._chip, cursor);
  }

  // ---------- mode ----------

  setMode(mode) {
    if (mode !== 'hover' && mode !== 'inspect') return;
    this._mode = mode;
    if (mode === 'hover' && this._outline) this._outline.style.display = 'none';
  }

  getMode() { return this._mode; }

  // ---------- outline ----------

  highlight(el) {
    if (!this._outline || !el) return;
    const r = el.getBoundingClientRect();
    this._outline.style.display = 'block';
    this._outline.style.width  = `${Math.round(r.width)}px`;
    this._outline.style.height = `${Math.round(r.height)}px`;
    this._outline.style.transform = `translate3d(${Math.round(r.left)}px, ${Math.round(r.top)}px, 0)`;
  }

  // ---------- input ----------

  handleClick(el, ev) {
    if (ev && typeof ev.preventDefault === 'function')  ev.preventDefault();
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();

    if (this._mode === 'inspect') {
      this._onEmit({ kind: 'inspect-click', target: el });
      return;
    }

    // Hover-mode click → stamp a persistent expanded card at the click point
    // (WhatFont parity: every click leaves a card, multiple coexist). Also
    // emit the detected row to the side panel.
    const detail = this._lastDetail?.detail || this._detect(el);
    const cursor = (ev && Number.isFinite(ev.clientX))
      ? { x: ev.clientX, y: ev.clientY }
      : (this._lastDetail?.cursor || { x: 0, y: 0 });
    this.pinCard(detail, cursor);
    this._onEmit({ kind: 'hover-click', target: el, detail });
  }

  handleKey(ev) {
    if (!ev) return;
    if (ev.key === 'Escape') {
      if (this._pins.length) { this.clearPins(); return; }
      if (this._mode === 'inspect') { this.setMode('hover'); return; }
    }
  }
}
