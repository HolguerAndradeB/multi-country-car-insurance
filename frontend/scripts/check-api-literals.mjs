/**
 * US01-U22 static guard (ADR-001 C5):
 * Fails if any `/api/` string literal appears inside `frontend/src/app/**`
 * outside `frontend/src/app/core/catalogue/catalogue.api.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(import.meta.dirname, '..', 'src', 'app');
const ALLOWED_FILE = path.resolve(APP_DIR, 'core', 'catalogue', 'catalogue.api.ts');

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (/\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
      results.push(full);
    }
  }
  return results;
}

const violations = [];
for (const file of walk(APP_DIR)) {
  if (path.resolve(file) === ALLOWED_FILE) {
    continue;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (line.includes('/api/')) {
      violations.push(`${path.relative(APP_DIR, file)}:${idx + 1}: ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error('US01-U22 FAILED: found /api/ literal outside CatalogueApi:\n' + violations.join('\n'));
  process.exit(1);
}

console.log('US01-U22 PASS: zero /api/ literals outside core/catalogue/catalogue.api.ts');
