import { describe, it, expect, beforeEach } from 'vitest';
import { extract } from './extractor.js';

function mkBody(html) {
  document.body.innerHTML = html;
  return document.body;
}

function fakeDetect(el) {
  const family = el.dataset.family || 'Inter';
  const fallback = el.dataset.fallback === 'true';
  const requested = el.dataset.requested ? el.dataset.requested.split(',') : [family];
  return {
    requested,
    rendered: family,
    isFallback: fallback,
    source: { type: el.dataset.source || 'self-hosted', format: 'woff2', url: null, os: null },
    isVariable: false,
    axes: null,
    metrics: {
      size: el.dataset.size || '16px',
      weight: Number(el.dataset.weight) || 400,
      lineHeight: el.dataset.lineHeight || '24px',
      letterSpacing: 'normal',
      transform: 'none',
      color: { rgb: 'rgb(34,34,34)', hex: el.dataset.hex || '#222222' },
    },
    confidence: 'high',
  };
}

const fakeRole = (el) => {
  const t = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(t)) return 'Headline';
  if (t === 'p') return 'Body';
  if (t === 'small') return 'Caption';
  return 'Body';
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('extract — basic walk', () => {
  it('returns one row per distinct style', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">Headline A</h1>
      <p  data-family="Inter" data-size="16px">Body one</p>
      <p  data-family="Inter" data-size="16px">Body two</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows.length).toBe(2);
  });

  it('counts duplicates correctly', () => {
    mkBody(`
      <p data-family="Inter" data-size="16px">a</p>
      <p data-family="Inter" data-size="16px">b</p>
      <p data-family="Inter" data-size="16px">c</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].count).toBe(3);
  });

  it('sorts rows by count descending', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">a</h1>
      <p  data-family="Inter" data-size="16px">b</p>
      <p  data-family="Inter" data-size="16px">c</p>
      <p  data-family="Inter" data-size="16px">d</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].count).toBe(3);
    expect(out.rows[1].count).toBe(1);
  });

  it('skips nodes with no direct visible text', () => {
    mkBody(`<div><p data-family="Inter">text</p></div>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows.length).toBe(1);
    expect(out.rows[0].count).toBe(1);
  });

  it('skips display:none nodes', () => {
    mkBody(`<p style="display:none" data-family="Inter">hidden</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows.length).toBe(0);
  });

  it('attaches role via inferRole', () => {
    mkBody(`<h1 data-family="Inter" data-size="32px">x</h1>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.rows[0].role).toBe('Headline');
  });

  it('honors maxNodes and reports truncated:true', () => {
    let html = '';
    for (let i = 0; i < 12; i++) html += `<p data-family="Inter">x${i}</p>`;
    mkBody(html);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole, maxNodes: 5 });
    expect(out.totalNodes).toBe(5);
    expect(out.truncated).toBe(true);
  });

  it('records hostname from option override', () => {
    mkBody(`<p data-family="Inter">x</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole, hostname: 'example.com' });
    expect(out.hostname).toBe('example.com');
  });
});

describe('extract — family grouping', () => {
  it('groups rows by rendered family', () => {
    mkBody(`
      <h1 data-family="Inter"  data-size="32px">a</h1>
      <p  data-family="Inter"  data-size="16px">b</p>
      <p  data-family="Georgia" data-size="16px" data-hex="#333333">c</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups.length).toBe(2);
    const families = out.groups.map(g => g.family).sort();
    expect(families).toEqual(['Georgia', 'Inter']);
  });

  it('sorts rows inside a group by count desc', () => {
    mkBody(`
      <h1 data-family="Inter" data-size="32px">A</h1>
      <p  data-family="Inter" data-size="16px">B1</p>
      <p  data-family="Inter" data-size="16px">B2</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    const inter = out.groups.find(g => g.family === 'Inter');
    expect(inter.rows[0].count).toBeGreaterThanOrEqual(inter.rows[1].count);
  });

  it('marks a group isFallback:true if any of its rows is a fallback', () => {
    mkBody(`
      <p data-family="Arial" data-fallback="true" data-requested="Söhne,Arial,sans-serif">x</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].isFallback).toBe(true);
    expect(out.groups[0].requestedFamily).toBe('Söhne');
  });

  it('puts fallback groups before non-fallback groups', () => {
    mkBody(`
      <p data-family="Inter">a</p>
      <p data-family="Inter">b</p>
      <p data-family="Inter">c</p>
      <p data-family="Arial" data-fallback="true" data-requested="Söhne,Arial">x</p>
    `);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].isFallback).toBe(true);
    expect(out.groups[1].isFallback).toBe(false);
  });

  it('propagates source classification from the first row of a group', () => {
    mkBody(`<p data-family="Inter" data-source="google">x</p>`);
    const out = extract(document.body, { detect: fakeDetect, inferRole: fakeRole });
    expect(out.groups[0].source.type).toBe('google');
  });
});
