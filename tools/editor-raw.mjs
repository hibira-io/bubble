// Builds the plugin as one JSON object in the shape the Bubble plugin editor
// saves (POST /appeditor/save_plugin {id, raw}), from this repository's files.
// node tools/editor-raw.mjs          write dist/editor-raw.json
// node tools/editor-raw.mjs --check  exit 1 if dist/editor-raw.json is stale
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const text = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const dirs = (rel) => fs.readdirSync(path.join(root, rel)).sort();

export function editorRaw() {
  const meta = json('meta_data.json');
  delete meta.image;
  const shared = json('shared_tech_params.json');
  const elements = {};
  for (const id of dirs('elements')) {
    const base = `elements/${id}`;
    const el = { ...json(`${base}/params.json`), platform_type: 'web' };
    el.code = Object.fromEntries(['initialize', 'update', 'preview', 'reset'].map((k) => [k, { fn: text(`${base}/${k}.js`) }]));
    el.headers = { snippet: text(`${base}/headers.html`) };
    el.actions = Object.fromEntries(dirs(`${base}/element_actions`).map((a) => [
      a, { ...json(`${base}/element_actions/${a}/params.json`), code: { fn: text(`${base}/element_actions/${a}/run.js`) } }
    ]));
    elements[id] = el;
  }
  const actions = Object.fromEntries(dirs('actions').map((a) => [a, {
    ...json(`actions/${a}/params.json`),
    code: { server: { fn: text(`actions/${a}/server.js`) }, client: { fn: text(`actions/${a}/client.js`) } }
  }]));
  return {
    dependencies: { use_jquery: true, plugin_api_version: 4 },
    meta_data: meta,
    // Above every ID used here, so IDs the editor assigns later never collide.
    editor_counter: 2000,
    shared_keys: shared.shared_keys,
    plugin_elements: elements,
    plugin_actions: actions
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const out = path.join(root, 'dist/editor-raw.json');
  const body = JSON.stringify(editorRaw(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== body) {
      console.error('dist/editor-raw.json is stale: run node tools/editor-raw.mjs');
      process.exit(1);
    }
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, body);
  }
}
