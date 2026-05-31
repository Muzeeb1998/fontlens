globalThis.__FONTLENS_TEST__ = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Overlay } from './overlay.js';

const fakeDetect = vi.fn(() => ({
  requested: ['Inter', 'sans-serif'],
  rendered: 'Inter',
  isFallback: false,
  source: { type: 'self-hosted', format: 'woff2', url: '/x.woff2', os: null },
  isVariable: false,
  axes: null,
  metrics: {
    size: '16px', weight: 400, lineHeight: '24px',
    letterSpacing: 'normal', transform: 'none',
    color: { rgb: 'rgb(34,34,34)', hex: '#222222' },
  },
  confidence: 'high',
}));

let overlay;

beforeEach(() => {
  document.body.innerHTML = '';
  fakeDetect.mockClear();
});

afterEach(() => {
  if (overlay) { overlay.unmount(); overlay = null; }
});

describe('Overlay — mount/unmount', () => {
  it('attaches a single shadow host to document.body', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.body.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    expect(hosts[0].shadowRoot).toBeTruthy();
  });

  it('attaches to documentElement when body is missing', () => {
    const body = document.body;
    body.remove();
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const hosts = document.documentElement.querySelectorAll('fontlens-overlay');
    expect(hosts.length).toBe(1);
    document.documentElement.appendChild(body);
  });

  it('mount() is idempotent — calling twice keeps one host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.mount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(1);
  });

  it('unmount() removes the host', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(document.body.querySelectorAll('fontlens-overlay').length).toBe(0);
  });

  it('unmount() is safe to call twice', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    overlay.unmount();
    expect(() => overlay.unmount()).not.toThrow();
  });

  it('injects a <style> child into the shadow root', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const styles = host.shadowRoot.querySelectorAll('style');
    expect(styles.length).toBeGreaterThanOrEqual(1);
    expect(styles[0].textContent).toContain('.chip');
  });

  it('renders the chip element hidden by default', () => {
    overlay = new Overlay({ detect: fakeDetect, onEmit: () => {} });
    overlay.mount();
    const host = document.body.querySelector('fontlens-overlay');
    const chip = host.shadowRoot.querySelector('.chip');
    expect(chip).toBeTruthy();
    expect(chip.style.display).toBe('none');
  });
});

describe('Overlay — chip render', () => {
  function mountWith(detectResult) {
    const det = vi.fn(() => detectResult);
    overlay = new Overlay({ detect: det, onEmit: () => {} });
    overlay.mount();
    overlay.show(document.createElement('p'), { x: 100, y: 100 });
    return overlay._chip;
  }

  const baseDetail = (overrides = {}) => ({
    requested: ['Inter', 'sans-serif'],
    rendered: 'Inter',
    isFallback: false,
    source: { type: 'self-hosted', format: 'woff2', url: null, os: null },
    isVariable: false, axes: null,
    metrics: { size: '16px', weight: 400, lineHeight: '24px', letterSpacing: 'normal', transform: 'none', color: { rgb: 'rgb(0,0,0)', hex: '#000000' } },
    confidence: 'high',
    ...overrides,
  });

  it('renders rendered face on line 1 (bold)', () => {
    const chip = mountWith(baseDetail());
    expect(chip.style.display).not.toBe('none');
    expect(chip.querySelector('.line1').textContent).toBe('Inter');
  });

  it('renders metrics line 2 as size · weight · lh/size', () => {
    const chip = mountWith(baseDetail());
    expect(chip.querySelector('.line2').textContent).toBe('16px · 400 · 24/16');
  });

  it('shows amber dot + fallback + requested rows when isFallback', () => {
    const chip = mountWith(baseDetail({
      requested: ['Söhne', 'Arial', 'sans-serif'],
      rendered: 'Arial', isFallback: true,
      source: { type: 'system', format: null, url: null, os: null },
    }));
    expect(chip.querySelector('.dot')).toBeTruthy();
    expect(chip.querySelector('.fallback').textContent).toContain('fallback');
    expect(chip.querySelector('.requested').textContent).toBe('requested: Söhne');
  });

  it('hides fallback rows when isFallback is false', () => {
    const chip = mountWith(baseDetail());
    expect(chip.querySelector('.fallback')).toBeNull();
    expect(chip.querySelector('.requested')).toBeNull();
  });

  it('shows low-confidence row when confidence === "low"', () => {
    const chip = mountWith(baseDetail({ confidence: 'low' }));
    expect(chip.querySelector('.lowconf').textContent).toContain("couldn't confirm");
  });

  it('renders an em dash when rendered is null', () => {
    const chip = mountWith(baseDetail({
      requested: ['Mystery'], rendered: null,
      source: { type: 'system', format: null, url: null, os: 'unknown' },
      confidence: 'low',
    }));
    expect(chip.querySelector('.line1').textContent).toBe('—');
  });

  it('hide() hides the chip and clears state', () => {
    const chip = mountWith(baseDetail());
    overlay.hide();
    expect(chip.style.display).toBe('none');
  });

  it('does not hide the chip when pinned', () => {
    const chip = mountWith(baseDetail());
    overlay.pin();
    overlay.hide();
    expect(chip.style.display).not.toBe('none');
  });
});
