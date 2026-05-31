import { describe, it, expect, beforeEach } from 'vitest';
import { collectShadowRoots } from './extractor-shadow.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('collectShadowRoots', () => {
  it('returns no roots for a plain DOM tree', () => {
    document.body.innerHTML = '<div><p>x</p></div>';
    const r = collectShadowRoots(document.body);
    expect(r.roots).toEqual([]);
    expect(r.closedCount).toBe(0);
  });

  it('collects one open shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = '<span>shadowed</span>';
    const r = collectShadowRoots(document.body);
    expect(r.roots).toHaveLength(1);
    expect(r.roots[0]).toBe(sh);
  });

  it('counts the closed-shadow marker when present', () => {
    const host = document.createElement('my-widget');
    host.__fontlensClosedShadow = true;
    document.body.appendChild(host);
    const r = collectShadowRoots(document.body);
    expect(r.closedCount).toBe(1);
  });

  it('does not count a plain custom element with no shadow as closed', () => {
    const host = document.createElement('my-widget');
    document.body.appendChild(host);
    const r = collectShadowRoots(document.body);
    expect(r.closedCount).toBe(0);
  });
});
