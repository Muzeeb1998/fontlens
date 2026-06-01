import { describe, it, expect, beforeEach } from 'vitest';
import { classifySource } from './source-classify.js';

function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

beforeEach(() => { document.head.innerHTML = ''; });

describe('classifySource', () => {
  it('returns system when no @font-face matches', () => {
    expect(classifySource('Arial').type).toBe('system');
  });

  it('classifies Google Fonts via fonts.gstatic.com', () => {
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('https://fonts.gstatic.com/s/inter/foo.woff2') format('woff2');
      }
    `);
    const r = classifySource('Inter');
    expect(r.type).toBe('google');
    expect(r.format).toBe('woff2');
  });

  it('classifies Adobe Fonts via use.typekit.net', () => {
    injectStyle(`
      @font-face {
        font-family: "Soehne";
        src: url('https://use.typekit.net/af/abc/soehne.woff2') format('woff2');
      }
    `);
    expect(classifySource('Soehne').type).toBe('adobe');
  });

  it('classifies self-hosted via any other URL', () => {
    injectStyle(`
      @font-face {
        font-family: "Local Sans";
        src: url('/fonts/local-sans.woff2') format('woff2');
      }
    `);
    expect(classifySource('Local Sans').type).toBe('self-hosted');
  });

  it('is case-insensitive on family name', () => {
    injectStyle(`
      @font-face {
        font-family: "Inter";
        src: url('https://fonts.gstatic.com/x.woff2') format('woff2');
      }
    `);
    expect(classifySource('inter').type).toBe('google');
  });

  it('reports format when present', () => {
    injectStyle(`
      @font-face {
        font-family: "X";
        src: url('/x.woff') format('woff');
      }
    `);
    expect(classifySource('X').format).toBe('woff');
  });

  it('resolves relative @font-face src against document.baseURI', () => {
    // happy-dom's document.baseURI = 'about:blank' by default. Stub it.
    const orig = document.baseURI;
    Object.defineProperty(document, 'baseURI', {
      configurable: true,
      get() { return 'https://x.ai/posts/article'; },
    });
    injectStyle(`
      @font-face {
        font-family: "Relative";
        src: url('/media/font.woff2') format('woff2');
      }
    `);
    const r = classifySource('Relative');
    expect(r.url).toBe('https://x.ai/media/font.woff2');
    Object.defineProperty(document, 'baseURI', { configurable: true, get() { return orig; } });
  });

  it('keeps an already-absolute https:// URL intact', () => {
    injectStyle(`
      @font-face {
        font-family: "Abs";
        src: url('https://cdn.example.com/abs.woff2') format('woff2');
      }
    `);
    expect(classifySource('Abs').url).toBe('https://cdn.example.com/abs.woff2');
  });
});
