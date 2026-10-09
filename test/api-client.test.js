import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient } from '../src/api-client.js';

test('API client prefixes the HTTPS service URL and sends JSON for writes', async () => {
  const requests = [];
  const client = createApiClient({
    baseUrl: 'https://api.example.test/',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ saved: true }) };
    },
  });

  assert.deepEqual(await client.get('/api/profile?playerId=player'), { saved: true });
  assert.deepEqual(await client.post('/api/answer', { correct: true }), { saved: true });
  assert.equal(requests[0].url, 'https://api.example.test/api/profile?playerId=player');
  assert.equal(requests[0].options.headers.Accept, 'application/json');
  assert.equal(requests[1].options.method, 'POST');
  assert.equal(requests[1].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[1].options.body, '{"correct":true}');
  assert.ok(requests.every(({ options }) => options.signal instanceof AbortSignal));
});

test('API client reports HTTP and local-only errors for the caller to handle', async () => {
  const failed = createApiClient({ fetchImpl: async () => ({ ok: false, status: 503 }) });
  const local = createApiClient({ localOnly: true, fetchImpl: async () => assert.fail('must not fetch') });

  await assert.rejects(failed.get('/api/profile'), /API 503/);
  await assert.rejects(local.post('/api/answer', {}), /local demo/);
});
