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
