import 'dotenv/config';
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
      bonusMultiplier: Number(body.bonusMultiplier || 1),
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

  if (request.method === 'POST' && url.pathname === '/api/generate-topic') {
    const body = await readJsonBody(request);
    const topic = sanitizeTopic(body.topic);
    const difficulty = sanitizeDifficulty(body.difficulty);
    const count = Math.min(Math.max(Number(body.count || 6), 4), 10);
    const accuracy = Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : 0.7;

    if (!topic) {
      sendJson(response, 400, { error: 'topic is required' });
      return;
    }

    const result = await generateTopicOrbs({ topic, difficulty, count, accuracy });
    sendJson(response, 200, result);
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

async function recordAnswer({ playerId, name, animalId, questionIndex, correct, bonusMultiplier }) {
  const profile = await ensureProfile(playerId, name);
  const previousLevel = getLevelForXp(profile.xp);
  profile.answersTotal += 1;

  let xpGained = 0;

  if (correct) {
    profile.answersCorrect += 1;
    profile.streak += 1;
    profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
    xpGained = getAnswerXp(profile.level, profile.streak, questionIndex, bonusMultiplier);
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

function getAnswerXp(level, streak, questionIndex, bonusMultiplier = 1) {
  const levelBonus = Math.min(level * 2, 24);
  const streakBonus = Math.min(streak * 4, 40);
  const questionBonus = Math.max(questionIndex, 0) * 3;
  const safeMultiplier = Math.min(Math.max(Number(bonusMultiplier) || 1, 1), 2);
  return Math.round((22 + levelBonus + streakBonus + questionBonus) * safeMultiplier);
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

async function generateTopicOrbs({ topic, difficulty, count, accuracy }) {
  const fallback = () => generateFallbackOrbs({ topic, difficulty, count, accuracy });

  if (!process.env.NVIDIA_API_KEY) {
    return { source: 'fallback', difficulty, ...fallback() };
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.NIM_MODEL || 'google/gemma-2-27b-it',
        temperature: 0.35,
        max_tokens: 2200,
        messages: [
          {
            role: 'system',
            content: 'Return only valid JSON. Create concise trivia AR orb data for a mobile educational scavenger hunt.',
          },
          {
            role: 'user',
            content: `Topic request: ${topic}\nDifficulty: ${difficulty}\nUser accuracy: ${accuracy}\nGenerate ${count} orbs. Each orb needs id, title, category, trait, journalNote, accent hex color, and exactly 3 multiple-choice questions. Each question must have prompt, options array of 3 strings, answer index 0-2. Categories should map to one of chemistry, math, geology, computer-science, biology, history, space, art, literature, general. Make questions harder if accuracy is high. JSON shape: {"topic":"...","summary":"...","orbs":[...]}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`NIM ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || '';
    const parsed = parseJsonObject(content);
    const normalized = normalizeGeneratedOrbs(parsed, { topic, difficulty, count });
    return { source: 'nim', difficulty, ...normalized };
  } catch (error) {
    console.warn('NIM generation failed, using fallback:', error.message);
    return { source: 'fallback', difficulty, ...fallback() };
  }
}

function parseJsonObject(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error('No JSON object returned');
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function normalizeGeneratedOrbs(payload, { topic, difficulty, count }) {
  const orbs = Array.isArray(payload?.orbs) ? payload.orbs : [];
  const normalized = orbs.slice(0, count).map((orb, index) => normalizeOrb(orb, topic, index)).filter(Boolean);

  if (normalized.length < count) {
    const fallback = generateFallbackOrbs({ topic, difficulty, count, accuracy: 0.7 }).orbs;
    normalized.push(...fallback.slice(normalized.length, count));
  }

  return {
    topic: String(payload?.topic || topic).slice(0, 80),
    summary: String(payload?.summary || `A custom ${topic} quest.`).slice(0, 180),
    orbs: normalized.slice(0, count),
  };
}

function normalizeOrb(orb, topic, index) {
  const questions = Array.isArray(orb?.questions) ? orb.questions.map(normalizeQuestion).filter(Boolean).slice(0, 3) : [];

  if (questions.length < 3) {
    return null;
  }

  return {
    id: sanitizeOrbId(orb.id || `${topic}-${index + 1}`),
    title: String(orb.title || `${topic} Orb ${index + 1}`).slice(0, 42),
    category: normalizeCategory(orb.category || topic),
    accent: /^#[0-9a-fA-F]{6}$/.test(orb.accent || '') ? orb.accent : getCategoryAccent(orb.category || topic),
    rarity: String(orb.rarity || 'Generated Quest').slice(0, 36),
    trait: String(orb.trait || 'Topic Signal').slice(0, 36),
    journalNote: String(orb.journalNote || `A ${topic} fact unlocked from this orb.`).slice(0, 180),
    questions,
  };
}

function normalizeQuestion(question) {
  const options = Array.isArray(question?.options) ? question.options.map((option) => String(option).slice(0, 80)).slice(0, 3) : [];
  const answer = Number(question?.answer);

  if (!question?.prompt || options.length !== 3 || !Number.isInteger(answer) || answer < 0 || answer > 2) {
    return null;
  }

  return {
    prompt: String(question.prompt).slice(0, 180),
    options,
    answer,
  };
}

function generateFallbackOrbs({ topic, difficulty, count, accuracy }) {
  const category = normalizeCategory(topic);
  const expert = difficulty === 'Expert' || accuracy >= 0.92;
  const hard = expert || difficulty === 'Hard' || accuracy >= 0.82;
  const medium = hard || difficulty === 'Medium' || accuracy >= 0.62;
  const templates = getFallbackQuestionTemplates(category, topic, { expert, hard, medium });
  const orbs = Array.from({ length: count }, (_, index) => {
    const title = getFallbackTitle(category, topic, index);
    return {
      id: sanitizeOrbId(`${category}-${Date.now()}-${index}`),
      title,
      category,
      accent: getCategoryAccent(category),
      rarity: expert ? 'Master Signal' : hard ? 'Expert Signal' : medium ? 'Focused Signal' : 'Starter Signal',
      trait: getCategoryTrait(category),
      journalNote: `You learned a ${topic} idea from ${title}.`,
      questions: templates.slice(index * 3, index * 3 + 3).map((question, questionIndex) => question || makeGenericQuestion(topic, index, questionIndex, hard)),
    };
  });

  return {
    topic,
    summary: `Generated ${count} ${topic} orbs at ${difficulty} difficulty.`,
    orbs,
  };
}

function getFallbackQuestionTemplates(category, topic, { expert, hard, medium }) {
  const banks = {
    chemistry: [
      ['What does pH measure?', ['Acidity', 'Mass', 'Temperature'], 0],
      ['Which particle has a negative charge?', ['Proton', 'Electron', 'Neutron'], 1],
      ['What is H2O?', ['Water', 'Salt', 'Oxygen'], 0],
      ['A catalyst does what?', ['Speeds a reaction', 'Deletes atoms', 'Stops all heat'], 0],
      ['Which bond shares electrons?', ['Ionic', 'Covalent', 'Metallic only'], 1],
      ['What is the center of an atom called?', ['Nucleus', 'Shell', 'Ion'], 0],
    ],
    math: [
      ['What is 12 x 8?', ['96', '86', '108'], 0],
      ['What does slope measure?', ['Steepness', 'Area', 'Volume'], 0],
      ['What is the square root of 81?', ['7', '9', '11'], 1],
      ['A prime number has how many positive factors?', ['2', '3', '4'], 0],
      ['What is 3/4 as a decimal?', ['0.34', '0.75', '1.25'], 1],
      ['What shape has 8 sides?', ['Hexagon', 'Octagon', 'Decagon'], 1],
    ],
    geology: [
      ['What type of rock forms from cooled lava?', ['Igneous', 'Sedimentary', 'Metamorphic'], 0],
      ['What scale measures earthquake magnitude?', ['Richter', 'Celsius', 'Beaufort'], 0],
      ['What is magma called after it reaches the surface?', ['Lava', 'Quartz', 'Clay'], 0],
      ['What process breaks rocks into smaller pieces?', ['Weathering', 'Orbiting', 'Condensing'], 0],
      ['Which mineral is common in granite?', ['Quartz', 'Ice', 'Coal'], 0],
      ['Sedimentary rocks often form in what?', ['Layers', 'Clouds', 'Stars'], 0],
    ],
    'computer-science': [
      ['What does CPU stand for?', ['Central Processing Unit', 'Code Power Utility', 'Computer Pixel Unit'], 0],
      ['Which value is boolean?', ['True', '42.5', 'Paragraph'], 0],
      ['What stores key-value pairs?', ['Map', 'Loop', 'Pixel'], 0],
      ['What does an algorithm describe?', ['Steps to solve a problem', 'A screen color', 'A network cable'], 0],
      ['Which structure is first-in, first-out?', ['Queue', 'Stack', 'Tree root'], 0],
      ['What does HTML structure?', ['Web content', 'Database indexes', 'Battery voltage'], 0],
    ],
    biology: [
      ['What do plants use for photosynthesis?', ['Sunlight', 'Plastic', 'Sound'], 0],
      ['DNA stores what?', ['Genetic instructions', 'Blood pressure', 'Heat only'], 0],
      ['What organ pumps blood?', ['Heart', 'Lung', 'Stomach'], 0],
      ['Cells are surrounded by what?', ['Membrane', 'Circuit', 'Crust'], 0],
      ['What gas do humans breathe in?', ['Oxygen', 'Helium', 'Methane'], 0],
      ['What is an ecosystem?', ['Living and nonliving interactions', 'One single bone', 'A math equation'], 0],
    ],
  };
  const selected = banks[category] || banks[normalizeCategory(topic)] || [
    [`What is the main idea of ${topic}?`, ['A key concept', 'A random guess', 'An unrelated fact'], 0],
    [`Why study ${topic}?`, ['To understand patterns', 'To avoid learning', 'To erase questions'], 0],
    [`What helps you master ${topic}?`, ['Practice', 'Ignoring feedback', 'Random clicking'], 0],
  ];
  const repeated = [];

  while (repeated.length < 30) {
    selected.forEach(([prompt, options, answer]) => repeated.push({
      prompt: expert
        ? `${prompt} Choose the most precise answer and watch for subtle distractors.`
        : hard
          ? `${prompt} Choose the most precise answer.`
          : medium
            ? `${prompt} Think carefully.`
            : prompt,
      options,
      answer,
    }));
  }

  return repeated;
}

function makeGenericQuestion(topic, index, questionIndex, hard) {
  return {
    prompt: hard ? `Which choice best explains ${topic} concept ${index + 1}.${questionIndex + 1}?` : `Which choice matches ${topic}?`,
    options: ['The best topic match', 'An unrelated idea', 'A random label'],
    answer: 0,
  };
}

function getFallbackTitle(category, topic, index) {
  const names = {
    chemistry: ['Flask Orb', 'Atom Orb', 'Reaction Orb', 'Molecule Orb', 'pH Orb', 'Catalyst Orb'],
    math: ['Plus Orb', 'Graph Orb', 'Prime Orb', 'Fraction Orb', 'Geometry Orb', 'Algebra Orb'],
    geology: ['Granite Orb', 'Fossil Orb', 'Volcano Orb', 'Quartz Orb', 'Fault Orb', 'Layer Orb'],
    'computer-science': ['Code Orb', 'Laptop Orb', 'Binary Orb', 'Network Orb', 'Array Orb', 'Algorithm Orb'],
    biology: ['Cell Orb', 'DNA Orb', 'Leaf Orb', 'Heart Orb', 'Ecosystem Orb', 'Neuron Orb'],
    history: ['Timeline Orb', 'Artifact Orb', 'Empire Orb', 'Revolution Orb', 'Map Orb', 'Archive Orb'],
    space: ['Planet Orb', 'Comet Orb', 'Galaxy Orb', 'Rocket Orb', 'Orbit Orb', 'Star Orb'],
    art: ['Palette Orb', 'Canvas Orb', 'Sculpture Orb', 'Color Orb', 'Gallery Orb', 'Brush Orb'],
    literature: ['Story Orb', 'Poetry Orb', 'Theme Orb', 'Symbol Orb', 'Plot Orb', 'Character Orb'],
  };
  return (names[category] || names.general || [`${topic} Orb`])[index % (names[category]?.length || 1)] || `${topic} Orb ${index + 1}`;
}

function getCategoryTrait(category) {
  return {
    chemistry: 'Lab Signal',
    math: 'Pattern Signal',
    geology: 'Earth Signal',
    'computer-science': 'Code Signal',
    biology: 'Life Signal',
    history: 'Archive Signal',
    space: 'Orbit Signal',
    art: 'Studio Signal',
    literature: 'Story Signal',
  }[normalizeCategory(category)] || 'Topic Signal';
}

function getCategoryAccent(category) {
  return {
    chemistry: '#79f0c2',
    math: '#8ad7ff',
    geology: '#d6a86f',
    'computer-science': '#9fb7ff',
    biology: '#8ef7a2',
    history: '#ffcf7d',
    space: '#c6a4ff',
    art: '#ff8fb8',
    literature: '#f8fbff',
    general: '#79f0c2',
  }[normalizeCategory(category)] || '#79f0c2';
}

function normalizeCategory(value) {
  const text = String(value || '').toLowerCase();

  if (/chem|atom|molecule|reaction|flask/.test(text)) return 'chemistry';
  if (/math|algebra|geometry|calculus|number|equation/.test(text)) return 'math';
  if (/geo|rock|earth|volcano|mineral|fossil/.test(text)) return 'geology';
  if (/computer|code|program|software|algorithm|ai|data/.test(text)) return 'computer-science';
  if (/bio|cell|animal|plant|life|dna/.test(text)) return 'biology';
  if (/history|war|empire|ancient|civilization/.test(text)) return 'history';
  if (/space|planet|star|galaxy|astronomy/.test(text)) return 'space';
  if (/art|paint|music|design|color/.test(text)) return 'art';
  if (/literature|book|poem|story|novel/.test(text)) return 'literature';
  return 'general';
}

function sanitizeTopic(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 140);
}

function sanitizeDifficulty(value) {
  const difficulty = String(value || '').trim();
  return ['Easy', 'Medium', 'Hard', 'Expert'].includes(difficulty) ? difficulty : 'Easy';
}

function sanitizeOrbId(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `orb-${Date.now()}`;
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
