import { describe, it, expect, beforeEach } from 'vitest';
import { extract } from './extractor.js';

beforeEach(() => { document.body.innerHTML = ''; });

describe('extract — edge case footnotes', () => {
  it('reports truncated:true when maxNodes is hit', () => {
    let html = '';
    for (let i = 0; i < 60; i++) html += `<p>n${i}</p>`;
    document.body.innerHTML = html;
    const r = extract(document.body, { maxNodes: 50 });
    expect(r.footnotes.truncated).toBe(true);
  });

  it('reports blockedFrames count', () => {
    const f = document.createElement('iframe');
    document.body.appendChild(f);
    Object.defineProperty(f, 'contentDocument', {
      get() { throw new Error('SecurityError'); },
      configurable: true,
    });
    const r = extract(document.body);
    expect(r.footnotes.blockedFrames).toBe(1);
  });

  it('returns empty groups for a blank root', () => {
    const r = extract(document.body);
    expect(r.groups).toEqual([]);
    expect(r.footnotes.truncated).toBe(false);
    expect(r.footnotes.blockedFrames).toBe(0);
    expect(r.footnotes.closedShadows).toBe(0);
  });

  it('counts closed shadows when marker is present', () => {
    const host = document.createElement('my-widget');
    host.__fontlensClosedShadow = true;
    document.body.appendChild(host);
    const r = extract(document.body);
    expect(r.footnotes.closedShadows).toBe(1);
  });
});
