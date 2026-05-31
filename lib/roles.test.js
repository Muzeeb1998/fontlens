import { describe, it, expect, beforeEach } from 'vitest';
import { inferRole } from './roles.js';

function make(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.role) el.setAttribute('role', opts.role);
  if (opts.text) el.textContent = opts.text;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('inferRole — semantic tags', () => {
  it.each([
    ['h1', 'Headline'], ['h2', 'Headline'], ['h3', 'Headline'],
    ['h4', 'Headline'], ['h5', 'Headline'], ['h6', 'Headline'],
  ])('maps %s to Headline', (tag, role) => {
    expect(inferRole(make(tag), { size: 16 })).toBe(role);
  });

  it('maps p to Body', () => {
    expect(inferRole(make('p'), { size: 16 })).toBe('Body');
  });

  it.each([['small'], ['figcaption'], ['caption']])(
    'maps %s to Caption', (tag) => {
      expect(inferRole(make(tag), { size: 12 })).toBe('Caption');
    }
  );

  it.each([['button'], ['label']])(
    'maps %s to Label', (tag) => {
      expect(inferRole(make(tag), { size: 14 })).toBe('Label');
    }
  );

  it.each([['code'], ['pre'], ['kbd'], ['samp']])(
    'maps %s to Code', (tag) => {
      expect(inferRole(make(tag), { size: 13 })).toBe('Code');
    }
  );
});

describe('inferRole — ARIA fallback', () => {
  it('honors role="heading" on a div', () => {
    expect(inferRole(make('div', { role: 'heading' }), { size: 14 })).toBe('Headline');
  });

  it('honors role="button" on a div', () => {
    expect(inferRole(make('div', { role: 'button' }), { size: 14 })).toBe('Label');
  });
});

describe('inferRole — size buckets on non-semantic tags', () => {
  it.each([['div'], ['span'], ['a']])('uses size on %s', (tag) => {
    expect(inferRole(make(tag), { size: 32 })).toBe('Headline');
    expect(inferRole(make(tag), { size: 16 })).toBe('Body');
    expect(inferRole(make(tag), { size: 12 })).toBe('Caption');
  });

  it('uses 24px as the Headline lower bound', () => {
    expect(inferRole(make('div'), { size: 24 })).toBe('Headline');
    expect(inferRole(make('div'), { size: 23 })).toBe('Body');
  });

  it('uses 13px as the Caption upper bound', () => {
    expect(inferRole(make('div'), { size: 13 })).toBe('Caption');
    expect(inferRole(make('div'), { size: 14 })).toBe('Body');
  });
});

describe('inferRole — fallback default', () => {
  it('returns Body for any unmatched tag', () => {
    expect(inferRole(make('article'), { size: 16 })).toBe('Body');
    expect(inferRole(make('section'), { size: 16 })).toBe('Body');
  });
});
