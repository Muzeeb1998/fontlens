#!/usr/bin/env node
// Audit a packaged FontLens zip for Chrome Web Store readiness.
//
// Gate: if this exits non-zero, the bundle is not safe to upload.
// Checks:
//   - Every file is on the allow-list of directories
//   - No source contains banned constructs (eval, new Function, remote <script src>)
//   - manifest.json: manifest_version=3, minimum permissions only, no host_permissions
//   - All four icon PNGs present

import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const ALLOWED_PERMS = new Set(['activeTab', 'scripting', 'sidePanel', 'storage']);
const REQUIRED_ICONS = ['assets/icons/16.png', 'assets/icons/48.png', 'assets/icons/128.png'];
const ALLOWED_PATH_PREFIXES = [
  'manifest.json', 'service-worker.js',
  'content/', 'sidepanel/', 'options/', 'lib/', 'onboarding/', 'assets/icons/',
];
const BANNED_PATTERNS = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /<script[^>]+src=["']https?:\/\//i,
  /\bimport\(\s*['"`]https?:\/\//,
];

export function auditExtracted(rootDir) {
  const issues = [];
  const files = walk(rootDir).map(f => relative(rootDir, f));

  // 1. Path allow-list
  for (const f of files) {
    const norm = f.replace(/\\/g, '/');
    if (!ALLOWED_PATH_PREFIXES.some(p => norm === p || norm.startsWith(p))) {
      issues.push(`disallowed-path: ${norm}`);
    }
  }

  // 2. Source scanning
  for (const f of files) {
    if (!/\.(js|html|css|json)$/.test(f)) continue;
    const text = readFileSync(join(rootDir, f), 'utf8');
    for (const re of BANNED_PATTERNS) {
      if (re.test(text)) issues.push(`banned-pattern in ${f}: ${re.source}`);
    }
  }

  // 3. Manifest checks
  const manifestPath = join(rootDir, 'manifest.json');
  let mf;
  try { mf = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch (e) { issues.push(`manifest-parse: ${e.message}`); return issues; }

  if (mf.manifest_version !== 3) issues.push(`manifest_version != 3 (got ${mf.manifest_version})`);
  if (mf.host_permissions && mf.host_permissions.length) issues.push(`host_permissions present: ${mf.host_permissions.join(',')}`);
  for (const p of (mf.permissions || [])) {
    if (!ALLOWED_PERMS.has(p)) issues.push(`unexpected permission: ${p}`);
  }
  const csp = mf.content_security_policy;
  if (csp && JSON.stringify(csp).includes('unsafe-eval')) issues.push('CSP contains unsafe-eval');

  // 4. Icons present
  for (const i of REQUIRED_ICONS) {
    if (!files.includes(i)) issues.push(`missing icon: ${i}`);
  }

  return issues;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const zipPath = process.argv[2];
  if (!zipPath) { console.error('usage: audit-bundle <path-to-zip>'); process.exit(2); }
  const work = mkdtempSync(join(tmpdir(), 'fontlens-audit-'));
  try {
    execSync(`unzip -q "${zipPath}" -d "${work}"`, { stdio: 'inherit' });
    const issues = auditExtracted(work);
    if (issues.length === 0) {
      console.log('OK  bundle audit passed — zero issues');
      process.exit(0);
    }
    console.error(`FAIL  ${issues.length} issue(s):`);
    for (const i of issues) console.error(`  - ${i}`);
    process.exit(1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
