import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, readJson, actionDirs, load } from './bubble.mjs';

const ID = /^A[A-Za-z0-9]{2}$/;
const ELEMENT = 'elements/AXA';

function allIds() {
  const ids = [];
  const add = (obj) => Object.keys(obj || {}).forEach((k) => ids.push(k));
  add(readJson('shared_tech_params.json').shared_keys);
  ids.push('AXA');
  const el = readJson(`${ELEMENT}/params.json`);
  add(el.fields); add(el.states); add(el.events);
  for (const a of fs.readdirSync(path.join(root, ELEMENT, 'element_actions'))) {
    ids.push(a);
    add(readJson(`${ELEMENT}/element_actions/${a}/params.json`).fields);
  }
  for (const a of actionDirs()) {
    ids.push(a);
    const p = readJson(`actions/${a}/params.json`);
    add(p.fields); add(p.return_value);
  }
  return ids;
}

test('every ID looks like a Bubble ID and is unique in the plugin', () => {
  const ids = allIds();
  ids.forEach((id) => assert.match(id, ID));
  assert.equal(new Set(ids).size, ids.length);
});

test('every JS file compiles as a Bubble function', () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).forEach((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith('.js')) files.push(rel);
  });
  walk('elements'); walk('actions');
  assert.ok(files.length > 10);
  files.forEach((f) => assert.equal(typeof load(f), 'function', f));
});

test('each server action reads only declared fields and returns its declared values', () => {
  for (const dir of actionDirs()) {
    const p = readJson(`actions/${dir}/params.json`);
    assert.equal(p.type, 'server_side');
    const src = fs.readFileSync(path.join(root, 'actions', dir, 'server.js'), 'utf8');
    const fields = Object.values(p.fields).map((f) => f.name);
    const used = new Set([...src.matchAll(/properties\.([a-z_]+)/g)].map((m) => m[1]));
    used.forEach((n) => assert.ok(fields.includes(n), `${dir} reads ${n}`));
    fields.forEach((n) => assert.ok(used.has(n), `${dir} never reads ${n}`));
    const returns = Object.values(p.return_value).map((r) => r.name).sort();
    for (const m of src.matchAll(/return (\{[^;]*\});/g)) {
      const bare = m[1].replace(/'(?:[^'\\]|\\.)*'/g, "''");
      const keys = [...bare.matchAll(/([a-z_]+):/g)].map((k) => k[1]).sort();
      assert.deepEqual(keys, returns, `${dir}: ${m[1]}`);
    }
  }
});

test('the element publishes only declared states and triggers only declared events', () => {
  const p = readJson(`${ELEMENT}/params.json`);
  const states = Object.values(p.states).map((s) => s.name);
  const events = Object.values(p.events).map((e) => e.name);
  const src = fs.readFileSync(path.join(root, ELEMENT, 'headers.html'), 'utf8')
    + fs.readFileSync(path.join(root, ELEMENT, 'initialize.js'), 'utf8');
  const published = new Set([...src.matchAll(/publish(?:State)?\('([a-z_]+)'/g)].map((m) => m[1]));
  const triggered = new Set([...src.matchAll(/trigger(?:Event)?\('([a-z_]+)'/g)].map((m) => m[1]));
  for (const m of src.matchAll(/trigger\(joined \? '([a-z_]+)' : '([a-z_]+)'\)/g)) { triggered.add(m[1]); triggered.add(m[2]); }
  published.forEach((n) => assert.ok(states.includes(n), `undeclared state ${n}`));
  states.forEach((n) => assert.ok(published.has(n), `state ${n} is never published`));
  triggered.forEach((n) => assert.ok(events.includes(n), `undeclared event ${n}`));
  events.forEach((n) => assert.ok(triggered.has(n), `event ${n} is never triggered`));
  const update = fs.readFileSync(path.join(root, ELEMENT, 'update.js'), 'utf8');
  const fields = Object.values(p.fields).map((f) => f.name);
  fields.forEach((n) => assert.ok(update.includes(`properties.${n}`), `field ${n} unused`));
});

test('the element reads only the plugin keys that exist', () => {
  const captions = Object.values(readJson('shared_tech_params.json').shared_keys).map((k) => k.caption);
  const files = [`${ELEMENT}/update.js`, 'tools/helpers.js'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/keys\['([^']+)'\]/g)) assert.ok(captions.includes(m[1]), `${f}: ${m[1]}`);
  }
});
