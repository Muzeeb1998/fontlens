#!/usr/bin/env node
// Produces dist/fontlens-<version>.zip ready for Chrome Web Store upload.

import { createWriteStream, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const version = manifest.version;
const outPath = join(DIST, `fontlens-${version}.zip`);

if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

const INCLUDE_GLOBS = [
  'manifest.json',
  'service-worker.js',
  'content/**/*',
  'sidepanel/**/*',
  'options/**/*',
  'lib/**/*',
  'onboarding/**/*',
  'assets/icons/16.png',
  'assets/icons/32.png',
  'assets/icons/48.png',
  'assets/icons/128.png',
];

const EXCLUDE_GLOBS = [
  '**/*.test.js',
  '**/.DS_Store',
  '**/.gitkeep',
  '**/__snapshots__/**',
];

const output = createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`OK  ${outPath}  (${kb} KB)`);
});
archive.on('warning', (err) => { if (err.code !== 'ENOENT') throw err; });
archive.on('error', (err) => { throw err; });
archive.pipe(output);

for (const pattern of INCLUDE_GLOBS) {
  archive.glob(pattern, { cwd: ROOT, ignore: EXCLUDE_GLOBS, dot: false });
}

await archive.finalize();
