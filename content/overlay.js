// content/overlay.js — Shadow-DOM hover chip + inspect outline.
// No chrome.* references — consumers wire messaging.

const STYLE_CSS = `
:host { all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none; contain: layout style; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
:host([data-pinned="true"]) { pointer-events: auto; }

/* ---------- compact chip ---------- */
.chip { position: absolute; top: 0; left: 0; min-width: 140px; max-width: 280px; padding: 10px 12px; background: #ffffff; color: #0f0f10; border: 1px solid #ececec; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.18); pointer-events: auto; user-select: none; transform: translate3d(0,0,0); transition: transform 80ms cubic-bezier(0.2, 0, 0, 1); will-change: transform; }
.chip[data-pinned="true"] { outline: 2px solid #d4d4d8; outline-offset: 2px; }
/* When expanded the chip is pinned (no cursor-follow), so drop the
   compositor-layer promotion — it softens text on HiDPI. Crisp render. */
.chip[data-expanded="true"] { min-width: 280px; max-width: 340px; padding: 14px 16px; will-change: auto; transition: none; }
@media (prefers-color-scheme: dark) {
  .chip { background:#0e0e10; color:#f5f5f7; border-color:#26262a; box-shadow:0 8px 24px rgba(0,0,0,0.6); }
  .chip[data-pinned="true"] { outline-color:#3a3a3f; }
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

/* ---------- expanded detail card ---------- */
.exp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.exp-title { font-weight: 600; font-size: 14px; line-height: 1.2; }
.exp-sub { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: #6b6b6e; margin-top: 2px; }
@media (prefers-color-scheme: dark) { .exp-sub { color:#a1a1a6; } }
.exp-close { background: none; border: 0; color: #6b6b6e; cursor: pointer; font: 600 16px/1 -apple-system; padding: 2px 6px; border-radius: 4px; }
.exp-close:hover, .exp-close:focus-visible { background: #f4f4f5; color: #0f0f10; outline: none; }
@media (prefers-color-scheme: dark) {
  .exp-close { color:#a1a1a6; }
  .exp-close:hover, .exp-close:focus-visible { background:#1f1f22; color:#f5f5f7; }
}
.exp-grid { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
.exp-cell { min-width: 0; }
.exp-label { font: 600 9px/1.2 -apple-system; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6b6e; margin-bottom: 4px; }
@media (prefers-color-scheme: dark) { .exp-label { color:#a1a1a6; } }
.exp-value { font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #0f0f10; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (prefers-color-scheme: dark) { .exp-value { color:#f5f5f7; } }
.exp-color-swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid #ececec; margin-right: 6px; vertical-align: -2px; }
@media (prefers-color-scheme: dark) { .exp-color-swatch { border-color:#26262a; } }
.exp-specimen { margin-top: 12px; padding-top: 12px; border-top: 1px solid #ececec; font-size: 18px; line-height: 1.4; word-break: break-word; }
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
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._mode = 'hover';
    this._lastDetail = null;
    this._expanded = false;
    this._outsideClickHandler = null;
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
    this._removeOutsideClickHandler();
    if (!this._host) return;
    this._host.remove();
    this._host = null;
    this._root = null;
    this._chip = null;
    this._outline = null;
    this._pinned = false;
    this._expanded = false;
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
    chip.setAttribute('data-expanded', this._expanded ? 'true' : 'false');

    if (this._expanded) this._renderExpanded(chip, detail);
    else this._renderCompact(chip, detail);
  }

  _renderCompact(chip, detail) {
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

    // View more → expanded detail card.
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'viewmore';
    more.textContent = 'View more →';
    more.setAttribute('aria-label', 'Show full font detail');
    more.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._setExpanded(true);
    });
    chip.appendChild(more);
  }

  _renderExpanded(chip, detail) {
    const m = detail.metrics || {};
    const family = detail.rendered || '—';
    const weight = m.weight ?? '—';
    const style  = m.style || detail?.requested?.length ? (m.style || 'normal') : 'normal';
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
    close.setAttribute('aria-label', 'Close detail');
    close.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._setExpanded(false);
      this.hide();
    });
    head.appendChild(close);
    chip.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'exp-grid';
    const cells = [
      ['Family',      family,       false],
      ['Style',       style,        false],
      ['Weight',      String(weight), false],
      ['Color',       color,        swatch],
      ['Size',        size,         false],
      ['Line Height', lh,           false],
    ];
    for (const [label, value, sw] of cells) {
      const cell = document.createElement('div');
      cell.className = 'exp-cell';
      const lab = document.createElement('div');
      lab.className = 'exp-label';
      lab.textContent = label;
      const val = document.createElement('div');
      val.className = 'exp-value';
      val.title = String(value); // full string on hover when truncated
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
    chip.appendChild(grid);

    // Specimen line rendered IN the detected font.
    const spec = document.createElement('div');
    spec.className = 'exp-specimen';
    spec.textContent = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq';
    if (detail.rendered) spec.style.fontFamily = `"${detail.rendered}", sans-serif`;
    spec.style.fontWeight = String(weight);
    chip.appendChild(spec);

    if (detail.isFallback) {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      const dot = document.createElement('span');
      dot.className = 'dot';
      fb.appendChild(dot);
      const txt = document.createElement('span');
      txt.textContent = `fallback — requested: ${detail.requested?.[0] || ''}`;
      fb.appendChild(txt);
      chip.appendChild(fb);
    }
  }

  _setExpanded(on) {
    this._expanded = !!on;
    if (this._expanded) {
      this._pinned = true;
      if (this._host) this._host.setAttribute('data-pinned', 'true');
      this._installOutsideClickHandler();
    } else {
      this._pinned = false;
      if (this._host) this._host.removeAttribute('data-pinned');
      this._removeOutsideClickHandler();
    }
    if (this._chip) this._chip.setAttribute('data-pinned', this._pinned ? 'true' : 'false');
    if (this._lastDetail?.detail) this._renderChip(this._lastDetail.detail);
  }

  _installOutsideClickHandler() {
    if (this._outsideClickHandler) return;
    this._outsideClickHandler = (ev) => {
      const path = ev.composedPath ? ev.composedPath() : [];
      if (this._host && path.includes(this._host)) return;
      this._setExpanded(false);
      this.hide();
    };
    document.addEventListener('mousedown', this._outsideClickHandler, true);
  }

  _removeOutsideClickHandler() {
    if (!this._outsideClickHandler) return;
    document.removeEventListener('mousedown', this._outsideClickHandler, true);
    this._outsideClickHandler = null;
  }

  // ---------- show / hide / pin ----------

  show(el, cursor) {
    if (!this._host) this.mount();
    if (this._pinned) return;

    // Always follow the cursor (cheap transform) so the chip tracks
    // smoothly — never freeze on a large element, that read as lag.
    // Only the EXPENSIVE work (detect + re-render) is skipped when the
    // element under the cursor hasn't changed. Reachability of "View more"
    // is handled by content.js: once the pointer is over the chip itself,
    // it's our own UI and show() stops being called, so the chip settles.
    const sameEl = this._lastDetail?.el === el;
    const detail = sameEl && this._lastDetail?.detail
      ? this._lastDetail.detail
      : this._detect(el);
    this._lastDetail = { detail, el, cursor };
    if (!sameEl) this._renderChip(detail);
    this._position(cursor);
  }

  hide() {
    if (this._pinned && !this._expanded) return;
    if (this._expanded) {
      // explicit dismiss path: collapse + drop pin
      this._expanded = false;
      this._pinned = false;
      this._host?.removeAttribute('data-pinned');
      this._removeOutsideClickHandler();
    }
    if (!this._chip) return;
    this._chip.style.display = 'none';
  }

  pin() {
    if (!this._lastDetail) return;
    this._pinned = true;
    if (this._host)  this._host.setAttribute('data-pinned', 'true');
    if (this._chip)  this._chip.setAttribute('data-pinned', 'true');
  }

  unpin() {
    this._pinned = false;
    if (this._host)  this._host.removeAttribute('data-pinned');
    if (this._chip)  this._chip.removeAttribute('data-pinned');
  }

  isPinned() { return this._pinned; }

  // ---------- positioning ----------

  _position(cursor) {
    if (!this._chip || !cursor) return;
    const offsetX = 14;
    const offsetY = 18;
    const rect = this._chip.getBoundingClientRect();
    const vw = (typeof window !== 'undefined' && window.innerWidth)  || 1024;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 768;

    let x = cursor.x + offsetX;
    let y = cursor.y + offsetY;

    if (x + rect.width > vw) {
      x = cursor.x - rect.width - offsetX;
    }
    if (y + rect.height > vh) {
      y = cursor.y - rect.height - offsetY;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;

    this._chip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
  }

  move(cursor) {
    if (this._pinned) return;
    if (!this._chip || this._chip.style.display === 'none') return;
    this._position(cursor);
  }

  // ---------- mode ----------

  setMode(mode) {
    if (mode !== 'hover' && mode !== 'inspect') return;
    this._mode = mode;
    if (mode === 'hover' && this._outline) {
      this._outline.style.display = 'none';
    }
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

    // Hover mode click: emit the detected row to the side panel BUT keep
    // the floating chip live so the user can continue hovering other text
    // and see new detections (WhatFont parity). Pinning is reserved for an
    // explicit gesture (Shift+click) so cursor-follow stays the default.
    const detail = this._lastDetail?.detail || this._detect(el);
    if (ev && (ev.shiftKey || ev.metaKey)) {
      this.pin();
    }
    this._onEmit({ kind: 'hover-click', target: el, detail });
  }

  handleKey(ev) {
    if (!ev) return;
    if (ev.key === 'Escape') {
      if (this._expanded) { this._setExpanded(false); this.hide(); return; }
      if (this._pinned) { this.unpin(); return; }
      if (this._mode === 'inspect') { this.setMode('hover'); return; }
    }
  }
}
