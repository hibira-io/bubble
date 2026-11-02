async function(properties, context) {
  // ---- Hibira helpers ----
  // Bubble actions can't share modules, so every action's server.js starts with
  // this block. Edit tools/helpers.js, then run: node tools/sync-helpers.mjs
  const crypto = require('crypto');
  const keys = context.keys || {};
  const cfg = {
    appId: String(keys['App ID'] || '').trim(),
    key: String(keys['App key'] || '').trim(),
    secret: String(keys['App secret'] || '').trim(),
    base: apiBase(keys['Host'])
  };

  function apiBase(raw) {
    let host = String(raw || '').trim() || 'ws.hibira.io';
    let scheme = 'https';
    const m = host.match(/^(wss?|https?):\/\//i);
    if (m) {
      scheme = /^(wss|https)$/i.test(m[1]) ? 'https' : 'http';
      host = host.slice(m[0].length);
    }
    return scheme + '://' + host.replace(/\/.*$/, '');
  }

  function missingKeys(needSecretOnly) {
    const missing = [];
    if (!needSecretOnly && !cfg.appId) missing.push('App ID');
    if (!cfg.key) missing.push('App key');
    if (!cfg.secret) missing.push('App secret');
    if (!missing.length) return '';
    return 'Fill in ' + missing.join(', ') + ' in Plugins > Hibira Realtime. They are on your app page in the Hibira portal (https://hibira.io).';
  }

  function splitList(value) {
    const list = Array.isArray(value) ? value : String(value || '').split(/[,\n]/);
    return list.map((s) => String(s).trim()).filter((s) => s !== '');
  }

  function hmac(data) {
    return crypto.createHmac('sha256', cfg.secret).update(data).digest('hex');
  }

  // Signs a request like the Pusher HTTP API: auth_* query parameters and an
  // HMAC-SHA256 of "METHOD\nPATH\nsorted query", with body_md5 for a body.
  function signedUrl(method, path, query, body, now) {
    const q = Object.assign({}, query || {});
    q.auth_key = cfg.key;
    q.auth_timestamp = String(Math.floor((now || Date.now()) / 1000));
    q.auth_version = '1.0';
    if (body) q.body_md5 = crypto.createHash('md5').update(body).digest('hex');
    const canonical = Object.keys(q)
      .map((k) => [k.toLowerCase(), String(q[k])])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map((pair) => pair[0] + '=' + pair[1])
      .join('&');
    const signature = hmac(method + '\n' + path + '\n' + canonical);
    return cfg.base + path + '?' + canonical + '&auth_signature=' + signature;
  }

  async function hibira(method, resource, payload, query) {
    const path = '/apps/' + encodeURIComponent(cfg.appId) + resource;
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const res = await fetch(signedUrl(method, path, query, body), {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body || undefined
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = null; }
    if (!res.ok) {
      const message = (json && (json.error || json.message)) || text || res.statusText;
      throw new Error('Hibira answered ' + res.status + ': ' + String(message).trim());
    }
    return json || {};
  }
  // ---- end Hibira helpers ----

  const empty = { approval_id: '', url: '', status: '', error: '' };
  const problem = missingKeys(false);
  if (problem) return Object.assign(empty, { error: problem });
  const title = String(properties.title || '').trim();
  if (!title) return Object.assign(empty, { error: 'Enter a title for the approval request.' });
  const body = { title: title };
  const choices = splitList(properties.choices);
  if (choices.length) body.options = choices;
  if (properties.details) body.details = String(properties.details);
  if (properties.expires_in_minutes) body.expires_in_minutes = Math.round(Number(properties.expires_in_minutes));
  if (properties.channel) body.channel = String(properties.channel).trim();
  if (properties.agent) body.agent = String(properties.agent).trim();
  const users = splitList(properties.push_users);
  if (users.length) body.push_users = users;
  const interests = splitList(properties.push_interests);
  if (interests.length) body.push_interests = interests;
  try {
    const out = await hibira('POST', '/approvals', body);
    return { approval_id: String(out.approval_id || ''), url: String(out.url || ''), status: String(out.status || ''), error: '' };
  } catch (e) {
    return Object.assign(empty, { error: e.message });
  }
}
