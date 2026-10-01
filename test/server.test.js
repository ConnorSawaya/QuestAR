import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test, { after, before } from 'node:test';

const projectDir = resolve(import.meta.dirname, '..');
let workingDir;
let serverProcess;
let baseUrl;

before(async () => {
  workingDir = await mkdtemp(join(process.env.TEMP || process.env.TMPDIR || '.', 'quest-ar-test-'));
  await mkdir(join(workingDir, 'dist'));
  await mkdir(join(workingDir, '.data'));
  await writeFile(join(workingDir, 'dist', 'index.html'), 'static app');
  await writeFile(join(workingDir, 'outside-secret.txt'), 'must not be served');
  const fullCollection = Object.fromEntries(Array.from({ length: 250 }, (_, index) => [`orb-${index}`, '2026-01-01T00:00:00.000Z']));
  await writeFile(join(workingDir, '.data', 'quest-ar-db.json'), JSON.stringify({
    players: {
      'crowded-player-id': {
        id: 'crowded-player-id', name: 'Explorer', xp: 0, level: 1, streak: 0, bestStreak: 0,
        answersCorrect: 0, answersTotal: 0, animalsCollected: fullCollection,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }));

  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, [join(projectDir, 'server.js')], {
    cwd: workingDir,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), TRUST_PROXY_HEADERS: 'true', NVIDIA_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const startupOutput = [];
  serverProcess.stdout.on('data', (chunk) => startupOutput.push(chunk.toString()));
  serverProcess.stderr.on('data', (chunk) => startupOutput.push(chunk.toString()));
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      assert.fail(`Quest AR server exited during startup: ${startupOutput.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/leaderboard`);
      if (response.status === 200) return;
    } catch {
      await delay(50);
    }
  }
  assert.fail(`Quest AR server did not start: ${startupOutput.join('')}`);
});

after(async () => {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill();
    await Promise.race([once(serverProcess, 'exit'), delay(2_000)]);
  }
  if (workingDir) await rm(workingDir, { recursive: true, force: true });
});

test('profiles accept browser UUIDs and reject malformed identifiers', async () => {
  const valid = await fetch(`${baseUrl}/api/profile?playerId=1fce7945-aec9-4af6-abe5-21d97b32316a&name=Explorer`);
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).profile.name, 'Explorer');

  const invalid = await fetch(`${baseUrl}/api/profile?playerId=../../etc/passwd`);
  assert.equal(invalid.status, 400);
});

test('answer and collection payloads are constrained to supported gameplay values', async () => {
  const common = { playerId: '1fce7945-aec9-4af6-abe5-21d97b32316a', animalId: 'starter-chemistry-flask' };
  const invalidAnswer = await fetch(`${baseUrl}/api/answer`, jsonRequest({ ...common, questionIndex: 999, correct: true }));
  assert.equal(invalidAnswer.status, 400);

  const invalidBonus = await fetch(`${baseUrl}/api/answer`, jsonRequest({ ...common, questionIndex: 2, correct: true, bonusMultiplier: 100_000 }));
  assert.equal(invalidBonus.status, 400);

  const validAnswer = await fetch(`${baseUrl}/api/answer`, jsonRequest({ ...common, questionIndex: 2, correct: true, bonusMultiplier: 1.6 }));
  assert.equal(validAnswer.status, 200);
  assert.ok((await validAnswer.json()).xpGained > 0);

  const invalidCollection = await fetch(`${baseUrl}/api/collect`, jsonRequest({ ...common, animalId: '../profile' }));
  assert.equal(invalidCollection.status, 400);

  const collection = await fetch(`${baseUrl}/api/collect`, jsonRequest(common));
  assert.equal(collection.status, 200);
  assert.ok((await collection.json()).xpGained > 0);

  const repeatedCollection = await fetch(`${baseUrl}/api/collect`, jsonRequest(common));
  assert.equal((await repeatedCollection.json()).xpGained, 0);

  const cappedCollection = await fetch(`${baseUrl}/api/collect`, jsonRequest({ playerId: 'crowded-player-id', animalId: 'orb-250' }));
  assert.equal(cappedCollection.status, 409);
});

test('JSON request parsing rejects unsupported types, malformed objects, and oversized bodies', async () => {
  const unsupported = await fetch(`${baseUrl}/api/generate-topic`, {
    method: 'POST',
    headers: { 'X-Real-IP': '198.51.100.1' },
    body: 'topic',
  });
  assert.equal(unsupported.status, 415);

  const malformed = await fetch(`${baseUrl}/api/generate-topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': '198.51.100.1' },
    body: '{',
  });
  assert.equal(malformed.status, 400);

  const tooLarge = await fetch(`${baseUrl}/api/generate-topic`, jsonRequest({ topic: 'x'.repeat(17_000) }, { 'X-Real-IP': '198.51.100.1' }));
  assert.equal(tooLarge.status, 413);
});

test('topic generation validates cost-driving inputs and rate limits bursts', async () => {
  const invalidCount = await fetch(`${baseUrl}/api/generate-topic`, jsonRequest({ topic: 'space', count: 11 }, { 'X-Real-IP': '198.51.100.2' }));
  assert.equal(invalidCount.status, 400);

  for (let requestNumber = 0; requestNumber < 6; requestNumber += 1) {
    const response = await fetch(`${baseUrl}/api/generate-topic`, jsonRequest({ topic: 'space', count: 4, accuracy: 0.7 }, { 'X-Real-IP': '198.51.100.3' }));
    assert.equal(response.status, 200);
  }

  const limited = await fetch(`${baseUrl}/api/generate-topic`, {
    ...jsonRequest({ topic: 'space', count: 4 }, { 'X-Real-IP': '198.51.100.3' }),
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('static file serving blocks encoded path traversal', async () => {
  const rootPage = await fetch(`${baseUrl}/`);
  assert.equal(await rootPage.text(), 'static app');

  const traversal = await fetch(`${baseUrl}/%2e%2e%2foutside-secret.txt`);
  assert.equal(traversal.status, 404);
  assert.doesNotMatch(await traversal.text(), /must not be served/);
});

test('production startup requires persistent PostgreSQL storage', async () => {
  const port = await getFreePort();
  const env = { ...process.env, NODE_ENV: 'production', PORT: String(port) };
  delete env.DATABASE_URL;
  const child = spawn(process.execPath, [join(projectDir, 'server.js')], {
    cwd: workingDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const [code] = await Promise.race([once(child, 'exit'), delay(3_000).then(() => ['timeout'])]);
  if (code === 'timeout') child.kill();
  assert.equal(code, 1);
  assert.match(output, /DATABASE_URL is required in production/);
});

function jsonRequest(body, extraHeaders = {}) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

async function getFreePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolveProbe, rejectProbe) => probe.close((error) => error ? rejectProbe(error) : resolveProbe()));
  return port;
}
