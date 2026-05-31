import { detect } from '../../lib/detector.js';

await document.fonts.ready;

const fixtures = document.querySelectorAll('.fixture');
let passes = 0, fails = 0;

for (const fx of fixtures) {
  const subject = fx.querySelector('.subject');
  const expect = JSON.parse(fx.querySelector('.expect').textContent);
  const out = detect(subject);

  const errors = [];
  if ('rendered' in expect && out.rendered !== expect.rendered) {
    errors.push(`rendered: expected ${expect.rendered}, got ${out.rendered}`);
  }
  if ('rendered_not' in expect && out.rendered === expect.rendered_not) {
    errors.push(`rendered: expected NOT to be ${expect.rendered_not}, got ${out.rendered}`);
  }
  if ('isFallback' in expect && out.isFallback !== expect.isFallback) {
    errors.push(`isFallback: expected ${expect.isFallback}, got ${out.isFallback}`);
  }
  if ('source_type' in expect && out.source.type !== expect.source_type) {
    errors.push(`source.type: expected ${expect.source_type}, got ${out.source.type}`);
  }

  const report = fx.querySelector('.report');
  if (errors.length === 0) {
    passes++;
    report.classList.add('pass');
    report.textContent = `PASS\n${JSON.stringify(out, null, 2)}`;
  } else {
    fails++;
    report.classList.add('fail');
    report.textContent = `FAIL\n${errors.join('\n')}\n---\n${JSON.stringify(out, null, 2)}`;
  }
}

const summary = document.createElement('h2');
summary.textContent = `Summary: ${passes} passed, ${fails} failed`;
summary.style.color = fails ? '#b3261e' : '#137333';
document.body.insertBefore(summary, document.querySelector('.fixture'));
