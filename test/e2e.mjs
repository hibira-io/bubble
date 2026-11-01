// End-to-end test: the element and the server actions against a running
// Hibira (or any Pusher-compatible) server, in Chromium, with a small stand-in
// for Bubble's element runtime and workflows.
//   HIBIRA_HOST=http://127.0.0.1:6001 HIBIRA_APP_ID=... HIBIRA_KEY=... HIBIRA_SECRET=... node test/e2e.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { root, runAction, KEYS } from './bubble.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const keys = {
  'App ID': process.env.HIBIRA_APP_ID || KEYS['App ID'],
  'App key': process.env.HIBIRA_KEY || KEYS['App key'],
  'App secret': process.env.HIBIRA_SECRET || KEYS['App secret'],
  Host: process.env.HIBIRA_HOST || KEYS.Host
};
const EL = path.join(root, 'elements/AXA');
const read = (f) => fs.readFileSync(f, 'utf8');
const actionFile = (caption) => {
  const dir = fs.readdirSync(path.join(EL, 'element_actions'))
    .find((d) => JSON.parse(read(path.join(EL, 'element_actions', d, 'params.json'))).caption === caption);
  return read(path.join(EL, 'element_actions', dir, 'run.js'));
};

const harness = `
<!doctype html><meta charset="utf-8"><title>Bubble stand-in</title>
<body style="font:14px system-ui;padding:16px">
<script src="/jquery.js"></script>
${read(path.join(EL, 'headers.html')).replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/pusher-js@[^"]+/, '/pusher.js')}
<script>
const fns = ${JSON.stringify({
  initialize: read(path.join(EL, 'initialize.js')),
  update: read(path.join(EL, 'update.js')),
  reset: read(path.join(EL, 'reset.js')),
  complete: actionFile('Complete authorization'),
  clientEvent: actionFile('Send client event'),
  disconnect: actionFile('Disconnect')
})};
const compile = (src) => new Function('return (' + src + ')')();
const run = Object.fromEntries(Object.entries(fns).map(([k, v]) => [k, compile(v)]));
window.elements = {};
// A Bubble element instance: canvas, data, states, events.
window.addElement = (id, properties, user) => {
  const box = $('<div style="margin:4px 0;width:240px;height:24px"></div>').appendTo(document.body);
  const el = { id, states: {}, events: [], properties, user };
  const context = { keys: ${JSON.stringify({ 'App key': keys['App key'], Host: keys.Host })} };
  el.instance = {
    canvas: box, data: {},
    publishState: (n, v) => { el.states[n] = v; },
    triggerEvent: (n) => { el.events.push(n); onEvent(el, n); }
  };
  el.context = context;
  run.initialize(el.instance, context);
  run.update(el.instance, properties, context);
  elements[id] = el;
};
window.setProps = (id, props) => { const el = elements[id]; Object.assign(el.properties, props); run.update(el.instance, el.properties, el.context); };
window.action = (id, name, props) => { const el = elements[id]; run[name](el.instance, props || {}, el.context); };
// The builder's workflow for "authorization is needed".
async function onEvent(el, name) {
  if (name !== 'authorization_needed') return;
  if (el.user.refuse) return run.complete(el.instance, { error: 'not on the team' }, el.context);
  const r = await window.serverAction('Hibira - Authorize channel', {
    socket_id: el.states.auth_socket_id, channel: el.states.auth_channel, user_id: el.user.id, user_name: el.user.name
  });
  run.complete(el.instance, { auth: r.auth, channel_data: r.channel_data, error: r.error }, el.context);
}
</script>`;

const files = {
  '/': ['text/html', harness],
  '/jquery.js': ['text/javascript', read(require.resolve('jquery/dist/jquery.min.js'))],
  '/pusher.js': ['text/javascript', read(require.resolve('pusher-js/dist/web/pusher.min.js'))]
};
const server = http.createServer((req, res) => {
  const f = files[req.url.split('?')[0]];
  if (!f) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', f[0]);
  res.end(f[1]);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
async function openPage(name) {
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', (e) => console.error(name, 'page error', e.message));
  await page.exposeFunction('serverAction', (display, props) => runAction(display, props, keys));
  await page.goto(url);
  return page;
}
const states = (page, id) => page.evaluate((i) => elements[i].states, id);
const events = (page, id) => page.evaluate((i) => elements[i].events, id);
async function until(fn, what, ms = 8000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out waiting for ' + what + ' (last: ' + JSON.stringify(last && last.message || last) + ')');
}
const step = (s) => console.log('ok -', s);

try {
  const a = await openPage('A');
  await a.evaluate(() => {
    addElement('room', { channel: 'presence-room', name_key: 'name', show_status: true }, { id: 'u1', name: 'Aki' });
    addElement('orders', { channel: 'orders', events: 'order-updated', value_key: 'order.status' }, { id: 'u1', name: 'Aki' });
  });
  await until(async () => (await states(a, 'room')).subscribed && (await states(a, 'orders')).subscribed, 'A subscribed');
  let s = await states(a, 'room');
  assert.equal(s.connection_state, 'connected');
  assert.equal(s.channel_type, 'presence');
  assert.equal(s.my_id, 'u1');
  assert.equal(s.my_name, 'Aki');
  assert.equal(s.member_count, 1);
  assert.equal(await a.evaluate(() => Object.keys(HibiraBubble.connections).length), 1);
  step('A joins a presence channel through the authorization workflow (one shared connection for two elements)');

  const b = await openPage('B');
  await b.evaluate(() => {
    addElement('room', { channel: 'presence-room' }, { id: 'u2', name: 'Ben' });
    addElement('orders', { channel: 'orders', events: 'order-updated', value_key: 'order.status' }, { id: 'u2', name: 'Ben' });
  });
  await until(async () => (await states(a, 'room')).member_count === 2, 'A sees Ben');
  s = await states(a, 'room');
  assert.deepEqual([...s.member_names].sort(), ['Aki', 'Ben']);
  assert.equal(s.member_id, 'u2');
  assert.equal(s.member_name, 'Ben');
  assert.ok((await events(a, 'room')).includes('member_joined'));
  await until(async () => (await states(b, 'room')).member_count === 2, 'B sees both');
  step('B joins; A gets "a member joins" with Changed member name = Ben');

  const users = await runAction('Hibira - Get channel users', { channel: 'presence-room' }, keys);
  assert.deepEqual([...users.user_ids].sort(), ['u1', 'u2']);
  step('Get channel users lists u1 and u2');

  await until(async () => (await states(b, 'orders')).subscribed, 'B orders');
  const aSocket = (await states(a, 'orders')).socket_id;
  assert.match(aSocket, /^\d+\.\d+$/);
  let r = await runAction('Hibira - Publish event', { channels: 'orders', event: 'other-event', data: '{"x":1}' }, keys);
  assert.deepEqual(r, { ok: true, error: '' });
  r = await runAction('Hibira - Publish event', {
    channels: 'orders', event: 'order-updated', data: '{"order":{"id":7,"status":"shipped"}}', socket_id: aSocket
  }, keys);
  assert.deepEqual(r, { ok: true, error: '' });
  await until(async () => (await states(b, 'orders')).last_value === 'shipped', 'B gets the order event');
  s = await states(b, 'orders');
  assert.equal(s.last_event, 'order-updated');
  assert.equal(s.last_channel, 'orders');
  assert.equal(s.event_count, 1, 'other-event is filtered out');
  assert.deepEqual(JSON.parse(s.last_data), { order: { id: 7, status: 'shipped' } });
  await new Promise((res) => setTimeout(res, 500));
  assert.equal((await states(a, 'orders')).event_count ?? 0, 0, 'A was skipped by socket ID');
  step('Publish event reaches B with Last value = shipped; A is skipped; other events are filtered');

  await a.evaluate(() => action('room', 'clientEvent', { event: 'typing', data: '{"typing":true}' }));
  await until(async () => (await states(b, 'room')).last_event === 'client-typing', 'B gets the client event');
  assert.equal((await states(b, 'room')).last_data, '{"typing":true}');
  step('Send client event from A reaches B as client-typing');

  await b.evaluate(() => setProps('orders', { channel: 'orders-2' }));
  await until(async () => (await states(b, 'orders')).subscribed, 'B on orders-2');
  r = await runAction('Hibira - Publish event', { channels: 'orders-2', event: 'order-updated', data_fields: [{ key: 'order', value: 'x' }] }, keys);
  assert.deepEqual(r, { ok: true, error: '' });
  await until(async () => (await states(b, 'orders')).event_count === 2, 'B gets orders-2 event');
  assert.equal((await states(b, 'orders')).last_channel, 'orders-2');
  step('Changing the Channel field switches channels');

  const c = await openPage('C');
  await c.evaluate(() => addElement('secret', { channel: 'private-team' }, { id: 'u3', name: 'Cat', refuse: true }));
  await until(async () => (await states(c, 'secret')).error, 'C refused');
  assert.match((await states(c, 'secret')).error, /private-team/);
  assert.ok((await events(c, 'secret')).includes('error'));
  assert.notEqual((await states(c, 'secret')).subscribed, true);
  step('A refused authorization shows in the Error state and fires "an error occurs"');

  await b.close();
  await until(async () => (await states(a, 'room')).member_count === 1, 'A sees Ben leave');
  s = await states(a, 'room');
  assert.equal(s.member_name, 'Ben');
  assert.ok((await events(a, 'room')).includes('member_left'));
  step('B leaves; A gets "a member leaves" with Changed member name = Ben');

  await a.evaluate(() => action('room', 'disconnect'));
  await until(async () => (await states(a, 'room')).connection_state === 'disconnected', 'A disconnected');
  assert.ok((await events(a, 'room')).includes('disconnected'));
  step('Disconnect closes the connection and fires "is disconnected"');
  console.log('all end-to-end checks passed');
} finally {
  await browser.close();
  server.close();
}
