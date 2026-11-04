const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/weather.js');

const KEY = 'test-key-value';
const realFetch = global.fetch;
const realKey = process.env.OPENWEATHER_API_KEY;

function call(url, { method = 'GET' } = {}) {
  return new Promise((resolve) => {
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      end(body) { resolve({ status: this.statusCode, headers: this.headers, body: String(body ?? '') }); }
    };
    handler({ method, url, headers: { host: 'x' } }, res);
  });
}

function stubUpstream(body = { ok: true }, status = 200) {
  const urls = [];
  global.fetch = async (u) => {
    urls.push(String(u));
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return urls;
}

test.beforeEach(() => { process.env.OPENWEATHER_API_KEY = KEY; delete process.env.API_KEY; });
test.after(() => {
  global.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENWEATHER_API_KEY;
  else process.env.OPENWEATHER_API_KEY = realKey;
});

test('prototype property names are rejected as unknown endpoints', async () => {
  const urls = stubUpstream();
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const r = await call(`/api/weather?endpoint=${name}&q=x`);
    assert.equal(r.status, 400, name);
  }
  assert.equal(urls.length, 0);
});

test('a missing server key returns a clear error and calls nothing upstream', async () => {
  delete process.env.OPENWEATHER_API_KEY;
  const urls = stubUpstream();
  const r = await call('/api/weather?endpoint=weather&q=London');
  assert.equal(r.status, 500);
  assert.match(r.body, /OPENWEATHER_API_KEY/);
  assert.equal(urls.length, 0);
});

test('the server key is sent upstream, cannot be overridden, and is never returned', async () => {
  const urls = stubUpstream({ name: 'London' });
  const r = await call('/api/weather?endpoint=weather&q=London&appid=attacker');
  assert.equal(r.status, 200);
  const sent = new URL(urls[0]);
  assert.equal(sent.searchParams.get('appid'), KEY);
  assert.ok(!r.body.includes(KEY));
  assert.ok(!JSON.stringify(r.headers).includes(KEY));
});

test('upstream failures do not expose the key or internal details', async () => {
  global.fetch = async (u) => { throw new Error(`connect failed for ${u}`); };
  const realError = console.error;
  console.error = () => {};
  const r = await call('/api/weather?endpoint=weather&q=London');
  console.error = realError;
  assert.equal(r.status, 500);
  assert.ok(!r.body.includes(KEY));
});

test('upstream error status passes through', async () => {
  stubUpstream({ cod: 401, message: 'Invalid API key' }, 401);
  const r = await call('/api/weather?endpoint=weather&q=London');
  assert.equal(r.status, 401);
  assert.equal(r.headers['cache-control'], 'no-store');
});

test('missing query parameters and non-GET methods are rejected', async () => {
  const urls = stubUpstream();
  assert.equal((await call('/api/weather?endpoint=weather')).status, 400);
  assert.equal((await call('/api/weather?endpoint=uvi&lat=1')).status, 400);
  assert.equal((await call('/api/weather?endpoint=weather&q=x', { method: 'POST' })).status, 405);
  assert.equal(urls.length, 0);
});

test('map tiles only accept known layers and numeric coordinates', async () => {
  const urls = stubUpstream();
  assert.equal((await call('/api/weather?endpoint=tile&layer=evil&z=1&x=1&y=1')).status, 400);
  assert.equal((await call('/api/weather?endpoint=tile&layer=temp_new&z=../../x&x=1&y=1')).status, 400);
  assert.equal(urls.length, 0);
});
