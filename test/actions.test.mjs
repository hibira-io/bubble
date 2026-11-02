import test from 'node:test';
import assert from 'node:assert/strict';
import Pusher from 'pusher';
import { runAction, KEYS } from './bubble.mjs';

const official = new Pusher({ appId: KEYS['App ID'], key: KEYS['App key'], secret: KEYS['App secret'], host: 'localhost' });

function mockFetch(answer) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const { status = 200, body = {} } = typeof answer === 'function' ? answer(calls.at(-1)) : answer;
    return new Response(JSON.stringify(body), { status });
  };
  return calls;
}

test('Authorize channel signs private channels like the official library', async () => {
  const out = await runAction('Hibira - Authorize channel', { socket_id: '123.456', channel: 'private-orders' });
  assert.deepEqual(out, { auth: official.authorizeChannel('123.456', 'private-orders').auth, channel_data: '', error: '' });
});

test('Authorize channel signs presence channels with user info', async () => {
  const out = await runAction('Hibira - Authorize channel', {
    socket_id: '1.2', channel: 'presence-room', user_id: 'u1', user_name: 'Aki', user_info: '{"avatar":"a.png"}'
  });
  const data = { user_id: 'u1', user_info: { avatar: 'a.png', name: 'Aki' } };
  assert.deepEqual(out, { ...official.authorizeChannel('1.2', 'presence-room', data), error: '' });
});

test('Authorize channel refuses bad input with a message', async () => {
  for (const [props, re] of [
    [{ socket_id: 'x', channel: 'private-a' }, /Socket ID/],
    [{ socket_id: '1.2', channel: 'orders' }, /Only private- and presence-/],
    [{ socket_id: '1.2', channel: 'presence-a' }, /User ID/],
    [{ socket_id: '1.2', channel: 'presence-a', user_id: 'u', user_info: '[1]' }, /JSON object/]
  ]) {
    const out = await runAction('Hibira - Authorize channel', props);
    assert.equal(out.auth, '');
    assert.match(out.error, re);
  }
  const noKeys = await runAction('Hibira - Authorize channel', { socket_id: '1.2', channel: 'private-a' }, {});
  assert.match(noKeys.error, /App key, App secret/);
});

test('Publish event signs the request like the official library', async () => {
  const calls = mockFetch({ body: {} });
  const out = await runAction('Hibira - Publish event', { channels: 'a, b', event: 'hi', data: '{"x":1}', socket_id: '9.9' });
  assert.deepEqual(out, { ok: true, error: '' });
  const { url, init } = calls[0];
  assert.equal(url.origin + url.pathname, 'http://127.0.0.1:6001/apps/test-app/events');
  assert.deepEqual(JSON.parse(init.body), { name: 'hi', channels: ['a', 'b'], data: '{"x":1}', socket_id: '9.9' });
  const params = Object.fromEntries(url.searchParams);
  assert.equal(params.auth_version, '1.0');
  const qs = Object.entries(params).filter(([k]) => k !== 'auth_signature').sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('&');
  const crypto = await import('node:crypto');
  const sig = crypto.createHmac('sha256', KEYS['App secret']).update(`POST\n/apps/test-app/events\n${qs}`).digest('hex');
  assert.equal(params.auth_signature, sig);
  assert.equal(params.body_md5, crypto.createHash('md5').update(init.body).digest('hex'));
});

test('Publish event wraps text and key/value data', async () => {
  const calls = mockFetch({ body: {} });
  await runAction('Hibira - Publish event', { channels: 'a', event: 'e', data: 'hello' });
  assert.equal(JSON.parse(calls[0].init.body).data, '{"text":"hello"}');
  await runAction('Hibira - Publish event', { channels: 'a', event: 'e', data: 'ignored', data_fields: [{ key: 'k', value: 'v' }] });
  assert.equal(JSON.parse(calls[1].init.body).data, '{"k":"v"}');
  await runAction('Hibira - Publish event', { channels: 'a', event: 'e' });
  assert.equal(JSON.parse(calls[2].init.body).data, '{}');
});

test('Publish event reports API errors instead of throwing', async () => {
  mockFetch({ status: 403, body: { error: 'app disabled' } });
  const out = await runAction('Hibira - Publish event', { channels: 'a', event: 'e' });
  assert.deepEqual(out, { ok: false, error: 'Hibira answered 403: app disabled' });
  const missing = await runAction('Hibira - Publish event', { channels: '', event: 'e' });
  assert.match(missing.error, /at least one channel/);
});

test('Request approval and Get approval call the approvals API', async () => {
  const calls = mockFetch((c) => c.url.pathname.endsWith('/approvals')
    ? { body: { approval_id: 'apr_1', url: 'https://hibira.io/a/x', status: 'pending' } }
    : { body: { status: 'approved', choice: 'Approve', comment: 'ok' } });
  const req = await runAction('Hibira - Request approval', {
    title: 'Refund?', details: 'Order 1', choices: 'Yes, No', expires_in_minutes: 30, channel: 'private-hibira-approvals.ops',
    agent: 'Bubble', push_users: 'u1', push_interests: ''
  });
  assert.deepEqual(req, { approval_id: 'apr_1', url: 'https://hibira.io/a/x', status: 'pending', error: '' });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    title: 'Refund?', options: ['Yes', 'No'], details: 'Order 1', expires_in_minutes: 30,
    channel: 'private-hibira-approvals.ops', agent: 'Bubble', push_users: ['u1']
  });
  const got = await runAction('Hibira - Get approval', { approval_id: 'apr_1', wait_seconds: 99 });
  assert.deepEqual(got, { status: 'approved', answered: true, choice: 'Approve', comment: 'ok', error: '' });
  assert.equal(calls[1].url.pathname, '/apps/test-app/approvals/apr_1');
  assert.equal(calls[1].url.searchParams.get('wait'), '25');
  assert.equal(calls[1].init.method, 'GET');
});

test('the default host is ws.hibira.io over HTTPS', async () => {
  const calls = mockFetch({ body: { users: [{ id: 'a' }, { id: 'b' }] } });
  const out = await runAction('Hibira - Get channel users', { channel: 'presence-x' }, { ...KEYS, Host: '' });
  assert.deepEqual(out, { user_ids: ['a', 'b'], user_count: 2, error: '' });
  assert.equal(calls[0].url.origin, 'https://ws.hibira.io');
  assert.equal(calls[0].url.pathname, '/apps/test-app/channels/presence-x/users');
});
