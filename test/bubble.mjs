// Loads the plugin's Bubble files the way Bubble runs them.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);

export function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

export function actionDirs() {
  return fs.readdirSync(path.join(root, 'actions')).sort();
}

// Finds an action folder by its display name.
export function actionDir(display) {
  const dir = actionDirs().find((d) => readJson(`actions/${d}/params.json`).display === display);
  if (!dir) throw new Error('no action ' + display);
  return dir;
}

// Compiles a Bubble function file (a bare "function(...) {}" expression).
export function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  return new Function('require', 'fetch', `return (${src});`)(require, (...a) => globalThis.fetch(...a));
}

export const KEYS = {
  'App ID': 'test-app',
  'App key': 'test-key',
  'App secret': 'test-secret-0123456789abcdef',
  Host: 'http://127.0.0.1:6001'
};

// Runs a server-side action by display name.
export function runAction(display, properties, keys = KEYS) {
  return load(`actions/${actionDir(display)}/server.js`)(properties, { keys });
}
