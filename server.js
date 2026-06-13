import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import pg from 'pg';

const port = Number(process.env.PORT || 4173);
const distDir = join(process.cwd(), 'dist');
const localDbPath = join(process.cwd(), '.data', 'quest-ar-db.json');
const { Pool } = pg;

const postgresPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

await initializeDatabase();

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApiRequest(request, response, url);
      return;
    }

    serveStaticFile(url, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Server error' });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Quest AR server running on port ${port}`);
  console.log(postgresPool ? 'Database: PostgreSQL' : 'Database: local JSON file');
});

async function handleApiRequest(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/profile') {
    const playerId = sanitizePlayerId(url.searchParams.get('playerId'));
    const name = sanitizeName(url.searchParams.get('name'));

    if (!playerId) {
      sendJson(response, 400, { error: 'playerId is required' });
      return;
    }

    const profile = await ensureProfile(playerId, name);
    sendJson(response, 200, { profile: decorateProfile(profile), leaderboard: await getLeaderboard() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/answer') {
    const body = await readJsonBody(request);
    const playerId = sanitizePlayerId(body.playerId);
    const name = sanitizeName(body.name);

    if (!playerId) {
      sendJson(response, 400, { error: 'playerId is required' });
      return;
    }

    const result = await recordAnswer({
      playerId,
      name,
      animalId: String(body.animalId || ''),
      questionIndex: Number(body.questionIndex || 0),
      correct: Boolean(body.correct),
    });

    sendJson(response, 200, { ...result, leaderboard: await getLeaderboard() });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/collect') {
    const body = await readJsonBody(request);
    const playerId = sanitizePlayerId(body.playerId);
    const name = sanitizeName(body.name);

    if (!playerId) {
      sendJson(response, 400, { error: 'playerId is required' });
      return;
    }

    const result = await recordCollection({
      playerId,
      name,
      animalId: String(body.animalId || ''),
    });

    sendJson(response, 200, { ...result, leaderboard: await getLeaderboard() });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    sendJson(response, 200, { leaderboard: await getLeaderboard() });
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

async function initializeDatabase() {
  if (!postgresPool) {
    await ensureLocalDb();
    return;
  }

  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      answers_correct INTEGER NOT NULL DEFAULT 0,
      answers_total INTEGER NOT NULL DEFAULT 0,
      animals_collected JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function ensureLocalDb() {
  await mkdir(dirname(localDbPath), { recursive: true });

  if (!existsSync(localDbPath)) {
    await writeLocalDb({ players: {} });
  }
}

async function ensureProfile(playerId, name) {
  const existing = await getProfile(playerId);

  if (existing) {
    if (name && existing.name !== name) {
      return updateProfileName(existing, name);
    }

    return existing;
  }

  const profile = {
    id: playerId,
    name: name || `Explorer ${playerId.slice(-4).toUpperCase()}`,
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    answersCorrect: 0,
    answersTotal: 0,
    animalsCollected: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveProfile(profile);
  return profile;
}

async function getProfile(playerId) {
  if (postgresPool) {
    const result = await postgresPool.query('SELECT * FROM players WHERE id = $1', [playerId]);
    return result.rows[0] ? normalizePgProfile(result.rows[0]) : null;
  }

  const db = await readLocalDb();
  return db.players[playerId] || null;
}

async function updateProfileName(profile, name) {
  const updated = { ...profile, name, updatedAt: new Date().toISOString() };
  await saveProfile(updated);
  return updated;
}

async function saveProfile(profile) {
  profile.level = getLevelForXp(profile.xp);
  profile.updatedAt = new Date().toISOString();

  if (postgresPool) {
    await postgresPool.query(
      `INSERT INTO players (id, name, xp, level, streak, best_streak, answers_correct, answers_total, animals_collected, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), COALESCE($10::timestamptz, NOW()))
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        xp = EXCLUDED.xp,
        level = EXCLUDED.level,
        streak = EXCLUDED.streak,
        best_streak = EXCLUDED.best_streak,
        answers_correct = EXCLUDED.answers_correct,
        answers_total = EXCLUDED.answers_total,
        animals_collected = EXCLUDED.animals_collected,
        updated_at = NOW()`,
      [
        profile.id,
        profile.name,
        profile.xp,
        profile.level,
        profile.streak,
        profile.bestStreak,
        profile.answersCorrect,
        profile.answersTotal,
        JSON.stringify(profile.animalsCollected || {}),
        profile.createdAt || null,
      ],
    );
    return;
  }

  const db = await readLocalDb();
  db.players[profile.id] = profile;
  await writeLocalDb(db);
}

async function recordAnswer({ playerId, name, animalId, questionIndex, correct }) {
  const profile = await ensureProfile(playerId, name);
  const previousLevel = getLevelForXp(profile.xp);
  profile.answersTotal += 1;

  let xpGained = 0;

  if (correct) {
    profile.answersCorrect += 1;
    profile.streak += 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
    xpGained = getAnswerXp(profile.level, profile.streak, questionIndex);
    profile.xp += xpGained;
  } else {
    profile.streak = 0;
  }

  await saveProfile(profile);
  const decorated = decorateProfile(profile);
  return {
    profile: decorated,
    xpGained,
    leveledUp: decorated.level > previousLevel,
    difficulty: getDifficultyForLevel(decorated.level),
    correct,
  };
}

async function recordCollection({ playerId, name, animalId }) {
  const profile = await ensureProfile(playerId, name);
  const previousLevel = getLevelForXp(profile.xp);
  const alreadyCollected = Boolean(profile.animalsCollected?.[animalId]);
  const xpGained = alreadyCollected ? 0 : getCollectionXp(profile.level);

  profile.animalsCollected = {
    ...(profile.animalsCollected || {}),
    [animalId]: profile.animalsCollected?.[animalId] || new Date().toISOString(),
  };
  profile.xp += xpGained;

  await saveProfile(profile);
  const decorated = decorateProfile(profile);
  return {
    profile: decorated,
    xpGained,
    leveledUp: decorated.level > previousLevel,
    difficulty: getDifficultyForLevel(decorated.level),
  };
}

async function getLeaderboard() {
  if (postgresPool) {
    const result = await postgresPool.query(
      `SELECT id, name, xp, level, streak, best_streak, answers_correct, answers_total, animals_collected
       FROM players
       ORDER BY xp DESC, best_streak DESC, updated_at ASC
       LIMIT 10`,
    );

    return result.rows.map((row, index) => ({
      rank: index + 1,
      ...decorateProfile(normalizePgProfile(row)),
    }));
  }

  const db = await readLocalDb();
  return Object.values(db.players)
    .sort((a, b) => b.xp - a.xp || b.bestStreak - a.bestStreak || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((profile, index) => ({
      rank: index + 1,
      ...decorateProfile(profile),
    }));
}

function getAnswerXp(level, streak, questionIndex) {
  const levelBonus = Math.min(level * 2, 24);
  const streakBonus = Math.min(streak * 4, 40);
  const questionBonus = Math.max(questionIndex, 0) * 3;
  return 22 + levelBonus + streakBonus + questionBonus;
}

function getCollectionXp(level) {
  return 70 + Math.min(level * 5, 60);
}

function getLevelForXp(xp) {
  let level = 1;

  while (xp >= getXpForLevel(level + 1)) {
    level += 1;
  }

  return level;
}

function getXpForLevel(level) {
  if (level <= 1) {
    return 0;
  }

  return Math.round(120 * (level - 1) + 70 * (level - 1) ** 2);
}

function getDifficultyForLevel(level) {
  if (level >= 10) {
    return 'Expert';
  }

  if (level >= 6) {
    return 'Hard';
  }

  if (level >= 3) {
    return 'Medium';
  }

  return 'Easy';
}

function decorateProfile(profile) {
  const level = getLevelForXp(profile.xp || 0);
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const xpIntoLevel = (profile.xp || 0) - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const animalsCollected = profile.animalsCollected || {};

  return {
    id: profile.id,
    name: profile.name,
    xp: profile.xp || 0,
    level,
    streak: profile.streak || 0,
    bestStreak: profile.bestStreak || 0,
    answersCorrect: profile.answersCorrect || 0,
    answersTotal: profile.answersTotal || 0,
    animalsCollected,
    animalCount: Object.keys(animalsCollected).length,
    xpIntoLevel,
    xpForNextLevel,
    nextLevelXp,
    difficulty: getDifficultyForLevel(level),
  };
}

function normalizePgProfile(row) {
  return {
    id: row.id,
    name: row.name,
    xp: row.xp,
    level: row.level,
    streak: row.streak,
    bestStreak: row.best_streak,
    answersCorrect: row.answers_correct,
    answersTotal: row.answers_total,
    animalsCollected: row.animals_collected || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readLocalDb() {
  await ensureLocalDb();
  return JSON.parse(await readFile(localDbPath, 'utf8'));
}

async function writeLocalDb(db) {
  await mkdir(dirname(localDbPath), { recursive: true });
  await writeFile(localDbPath, JSON.stringify(db, null, 2));
}

function sanitizePlayerId(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

function sanitizeName(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 28);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 32_000) {
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(url, response) {
  const requestedPath = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const assetPath = join(distDir, requestedPath || 'index.html');
  const filePath = existsSync(assetPath) ? assetPath : join(distDir, 'index.html');
  const contentType = mimeTypes[extname(filePath)] || 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(response);
}
