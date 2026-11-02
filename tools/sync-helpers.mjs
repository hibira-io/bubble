// Copies tools/helpers.js into every actions/*/server.js, between the
// "---- Hibira helpers ----" and "---- end Hibira helpers ----" lines.
// node tools/sync-helpers.mjs          rewrite the files
// node tools/sync-helpers.mjs --check  exit 1 if any file differs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const helpers = fs.readFileSync(path.join(root, 'tools/helpers.js'), 'utf8').replace(/\n$/, '');
const re = /  \/\/ ---- Hibira helpers ----[\s\S]*?\/\/ ---- end Hibira helpers ----/;
const check = process.argv.includes('--check');
let stale = 0;
for (const dir of fs.readdirSync(path.join(root, 'actions')).sort()) {
  const file = path.join(root, 'actions', dir, 'server.js');
  const src = fs.readFileSync(file, 'utf8');
  if (!re.test(src)) throw new Error(file + ' has no helper block');
  const out = src.replace(re, () => helpers);
  if (out !== src) {
    stale += 1;
    if (check) console.error(file + ' has an outdated helper block');
    else fs.writeFileSync(file, out);
  }
}
if (check && stale) process.exit(1);
