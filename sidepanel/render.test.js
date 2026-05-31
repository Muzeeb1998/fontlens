import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderHeader, renderBanner, renderSummary,
  renderGroups, renderEmpty, renderTruncated,
  focusRow, countRows,
} from './render.js';
import { fallbackPayload, cleanPayload } from '../test/fixtures/extract-payload.js';

let header, banner, bannerText, summary, region;

beforeEach(() => {
  document.body.innerHTML = `
    <header id="h">
      <div id="m"><button id="m-hover" aria-pressed="false"></button><button id="m-inspect" aria-pressed="false"></button></div>
      <div id="t"><button id="t-auto" aria-pressed="false"></button><button id="t-light" aria-pressed="false"></button><button id="t-dark" aria-pressed="false"></button></div>
    </header>
    <div id="b" hidden><span id="bt"></span></div>
    <p id="s"></p>
    <main id="r"></main>
  `;
  header = document.getElementById('h');
  banner = document.getElementById('b');
  bannerText = document.getElementById('bt');
  summary = document.getElementById('s');
  region = document.getElementById('r');
});

describe('renderHeader', () => {
  it('sets aria-pressed on the active mode button', () => {
    renderHeader(header, { mode: 'inspect', theme: 'auto' });
    expect(document.getElementById('m-hover').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('m-inspect').getAttribute('aria-pressed')).toBe('true');
  });
  it('sets aria-pressed on the active theme button', () => {
    renderHeader(header, { mode: 'hover', theme: 'dark' });
    expect(document.getElementById('t-auto').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('t-light').getAttribute('aria-pressed')).toBe('false');
    expect(document.getElementById('t-dark').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('renderBanner', () => {
  it('shows banner when fallbackCount > 0 with correct count text', () => {
    renderBanner(banner, bannerText, { fallbackCount: 2 });
    expect(banner.hasAttribute('hidden')).toBe(false);
    expect(bannerText.textContent).toMatch(/2 of this page'?s fonts/);
  });
  it('hides banner when fallbackCount is 0', () => {
    renderBanner(banner, bannerText, { fallbackCount: 0 });
    expect(banner.hasAttribute('hidden')).toBe(true);
  });
  it('uses singular phrasing when fallbackCount is 1', () => {
    renderBanner(banner, bannerText, { fallbackCount: 1 });
    expect(bannerText.textContent).toMatch(/1 of this page'?s fonts isn'?t loading/);
  });
});

describe('renderSummary', () => {
  it('renders "N fonts · M styles · hostname"', () => {
    renderSummary(summary, fallbackPayload);
    expect(summary.textContent).toContain('2 fonts');
    expect(summary.textContent).toContain('3 type styles');
    expect(summary.textContent).toContain('example.com');
  });
  it('uses tabular-nums style for alignment', () => {
    renderSummary(summary, fallbackPayload);
    expect(summary.style.fontVariantNumeric || getComputedStyle(summary).fontVariantNumeric)
      .toBeDefined();
  });
});

describe('renderGroups', () => {
  it('creates one card per family group', () => {
    renderGroups(region, fallbackPayload, {});
    expect(region.querySelectorAll('.fl-card').length).toBe(2);
  });

  it('marks fallback cards with is-fallback class', () => {
    renderGroups(region, fallbackPayload, {});
    const firstCard = region.querySelector('.fl-card');
    expect(firstCard.classList.contains('is-fallback')).toBe(true);
  });

  it('reads "Söhne → Arial" on the fallback card header', () => {
    renderGroups(region, fallbackPayload, {});
    const firstHead = region.querySelector('.fl-card.is-fallback .fl-card-name');
    expect(firstHead.textContent).toContain('Söhne');
    expect(firstHead.textContent).toContain('Arial');
  });

  it('renders rows sorted by count desc inside a group', () => {
    renderGroups(region, fallbackPayload, {});
    const interCard = region.querySelectorAll('.fl-card')[1];
    const counts = [...interCard.querySelectorAll('.fl-row-count')].map(n => Number(n.textContent.trim()));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('puts the uppercase role mini-label on each row', () => {
    renderGroups(region, fallbackPayload, {});
    const roles = [...region.querySelectorAll('.fl-row-role')].map(n => n.textContent.trim());
    expect(roles).toContain('BODY');
    expect(roles).toContain('HEADLINE');
  });

  it('attaches data-row-key + data-row-index to each row', () => {
    renderGroups(region, fallbackPayload, {});
    const rows = region.querySelectorAll('.fl-row');
    rows.forEach((r, i) => {
      expect(r.dataset.rowKey).toBeTruthy();
      expect(Number(r.dataset.rowIndex)).toBe(i);
    });
  });

  it('sets role landmarks on cards/rows for a11y', () => {
    renderGroups(region, fallbackPayload, {});
    expect(region.querySelector('.fl-card').getAttribute('role')).toBe('group');
    const row = region.querySelector('.fl-row');
    expect(row.getAttribute('role')).toBe('button');
  });

  it('the first row in the region has tabindex=0', () => {
    renderGroups(region, fallbackPayload, {});
    const rows = region.querySelectorAll('.fl-row');
    expect(rows[0].getAttribute('tabindex')).toBe('0');
  });

  it('calls onHighlight on mouseenter and onUnhighlight on mouseleave', () => {
    let on = null, off = null;
    renderGroups(region, cleanPayload, {
      onHighlight: (row) => { on = row.key; },
      onUnhighlight: (row) => { off = row.key; },
    });
    const row = region.querySelector('.fl-row');
    row.dispatchEvent(new Event('mouseenter'));
    expect(on).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
    row.dispatchEvent(new Event('mouseleave'));
    expect(off).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
  });

  it('calls onActivate on click', () => {
    let clicked = null;
    renderGroups(region, cleanPayload, { onActivate: (row) => { clicked = row.key; } });
    region.querySelector('.fl-row').click();
    expect(clicked).toBe('Inter|16px|400|24px|normal|none|#0f0f10');
  });

  it('sets aria-label on the specimen with plain-language metrics', () => {
    renderGroups(region, cleanPayload, {});
    const specimen = region.querySelector('.fl-row-specimen');
    expect(specimen.getAttribute('aria-label')).toMatch(/Inter/);
    expect(specimen.getAttribute('aria-label')).toMatch(/16/);
    expect(specimen.getAttribute('aria-label')).toMatch(/400/);
  });

  it('renders specimen in the detected face via inline font-family', () => {
    renderGroups(region, cleanPayload, {});
    const specimen = region.querySelector('.fl-row-specimen');
    expect(specimen.style.fontFamily).toMatch(/Inter/);
    expect(specimen.style.fontWeight).toBe('400');
  });

  it('adds a fallback badge to fallback cards', () => {
    renderGroups(region, fallbackPayload, {});
    const badge = region.querySelector('.fl-card.is-fallback .fl-badge.is-fallback');
    expect(badge).toBeTruthy();
    expect(badge.textContent.toUpperCase()).toBe('FALLBACK');
  });
});

describe('renderEmpty + renderTruncated', () => {
  it('renders empty state', () => {
    renderEmpty(region);
    expect(region.querySelector('.fl-empty')).toBeTruthy();
  });

  it('renders truncated footer with the node count', () => {
    renderGroups(region, cleanPayload, {});
    renderTruncated(region, 5000);
    const t = region.querySelector('.fl-truncated');
    expect(t).toBeTruthy();
    expect(t.textContent).toContain('5000');
  });
});

describe('focusRow + countRows', () => {
  it('counts rows correctly', () => {
    renderGroups(region, fallbackPayload, {});
    expect(countRows(region)).toBe(3);
  });

  it('moves focus and tabindex when focusRow is called', () => {
    renderGroups(region, fallbackPayload, {});
    focusRow(region, 1);
    const rows = region.querySelectorAll('.fl-row');
    expect(rows[1].getAttribute('tabindex')).toBe('0');
    expect(rows[0].getAttribute('tabindex')).toBe('-1');
  });
});
