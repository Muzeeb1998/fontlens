import { describe, it, expect } from 'vitest';
import { snippetsFor, googleSnippets, paidSnippets, systemSnippets, selfHostedSnippets } from './snippets.js';

describe('googleSnippets', () => {
  const meta = {
    kind: 'google',
    name: 'Inter',
    slug: 'Inter',
    category: 'sans-serif',
    weights: [100, 400, 500, 700, 900],
    specimenUrl: 'https://fonts.google.com/specimen/Inter',
  };

  it('emits a <link> tag with css2 URL + display=swap', () => {
    const s = googleSnippets(meta);
    expect(s.link).toMatch(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@/);
    expect(s.link).toMatch(/display=swap/);
    expect(s.link).toMatch(/ rel="stylesheet">/);
  });

  it('emits a preconnect bundle for production sites', () => {
    const s = googleSnippets(meta);
    expect(s.preconnect).toMatch(/preconnect.*fonts\.googleapis\.com/s);
    expect(s.preconnect).toMatch(/preconnect.*fonts\.gstatic\.com[^>]*crossorigin/);
  });

  it('emits an @import line', () => {
    expect(googleSnippets(meta).importCss).toMatch(/^@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:wght@/);
  });

  it('emits CSS with category fallback', () => {
    expect(googleSnippets(meta).css).toBe('font-family: Inter, sans-serif;');
  });

  it('quotes multi-word family names', () => {
    const s = googleSnippets({ ...meta, name: 'Playfair Display', slug: 'Playfair+Display' });
    expect(s.css).toBe('font-family: "Playfair Display", sans-serif;');
  });

  it('picks default-scale weights only when available', () => {
    const s = googleSnippets({ ...meta, weights: [200, 400, 700] });
    expect(s.link).toMatch(/wght@400;700/);
  });

  it('falls back to first available weight when none in default pref list', () => {
    const s = googleSnippets({ ...meta, weights: [850] });
    expect(s.link).toMatch(/wght@850/);
  });
});

describe('paidSnippets', () => {
  it('returns foundry + url + license-aware CSS comment', () => {
    const s = paidSnippets({ name: 'Söhne', foundry: 'Klim Type Foundry', url: 'https://klim.co.nz/retail-fonts/soehne/' });
    expect(s.foundry).toBe('Klim Type Foundry');
    expect(s.url).toBe('https://klim.co.nz/retail-fonts/soehne/');
    expect(s.css).toMatch(/font-family: "Söhne", sans-serif/);
    expect(s.css).toMatch(/license required/);
  });

  it('never emits a download URL or self-hosted snippet', () => {
    const s = paidSnippets({ name: 'Söhne', foundry: 'Klim', url: 'https://klim.co.nz/retail-fonts/soehne/' });
    expect(s.css).not.toMatch(/@font-face/);
    expect(s.url).toMatch(/^https:\/\/klim\.co\.nz\//);
  });
});

describe('systemSnippets', () => {
  it('returns the canonical system-ui stack', () => {
    const s = systemSnippets({ name: 'San Francisco', os: 'macos' });
    expect(s.css).toMatch(/-apple-system/);
    expect(s.css).toMatch(/Segoe UI/);
    expect(s.css).toMatch(/sans-serif/);
  });
});

describe('selfHostedSnippets', () => {
  it('returns an @font-face block + font-family line', () => {
    const s = selfHostedSnippets({ name: 'Brand Sans', url: 'https://cdn.example.com/b.woff2', format: 'woff2' });
    expect(s.css).toMatch(/@font-face/);
    expect(s.css).toMatch(/src: url\('https:\/\/cdn\.example\.com\/b\.woff2'\) format\('woff2'\)/);
    expect(s.css).toMatch(/font-family: "Brand Sans"/);
  });

  it('omits format() when missing', () => {
    const s = selfHostedSnippets({ name: 'Brand', url: 'https://cdn.example.com/b.woff2', format: null });
    expect(s.css).not.toMatch(/format\(/);
  });
});

describe('snippetsFor — dispatcher', () => {
  it('routes google', () => {
    const s = snippetsFor({ kind: 'google', name: 'Inter', slug: 'Inter', category: 'sans-serif', weights: [400] });
    expect(s.kind).toBe('google');
    expect(s.link).toMatch(/<link/);
  });

  it('routes paid', () => {
    const s = snippetsFor({ kind: 'paid', name: 'Söhne', foundry: 'Klim', url: 'https://klim.co.nz/x' });
    expect(s.kind).toBe('paid');
    expect(s.url).toBeTruthy();
  });

  it('routes system', () => {
    expect(snippetsFor({ kind: 'system', name: 'San Francisco', os: 'macos' }).kind).toBe('system');
  });

  it('routes selfhosted', () => {
    expect(snippetsFor({ kind: 'selfhosted', name: 'X', url: 'https://x', format: 'woff2' }).kind).toBe('selfhosted');
  });

  it('routes unknown', () => {
    expect(snippetsFor({ kind: 'unknown', name: 'Mystery' }).kind).toBe('unknown');
  });
});
