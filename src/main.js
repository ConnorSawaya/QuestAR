import './style.css';

import * as THREE from 'three';

const RETICLE_RADIUS = 0.16;
const COLLECTIBLE_HEIGHT = 0.56;
let TOTAL_COLLECTIBLES = 6;
const REVEAL_DISTANCE_METERS = 4;
const INTERACTION_DISTANCE_METERS = 3;
const DB_NAME = 'quest-ar-progress';
const DB_VERSION = 1;
const PROGRESS_STORE = 'animalProgress';
const PLAYER_ID_KEY = 'quest-ar-player-id';
const PLAYER_NAME_KEY = 'quest-ar-player-name';
const LOCAL_PROFILE_KEY = 'quest-ar-local-profile';

let TRIVIA_COLLECTIBLES = [
  {
    id: 'starter-chemistry-flask',
    accent: '#79f0c2',
    title: 'Flask Orb',
    category: 'chemistry',
    rarity: 'Starter Signal',
    trait: 'Lab Signal',
    journalNote: 'You learned that chemistry explains matter, reactions, and the tools scientists use in labs.',
    questions: [
      {
        prompt: 'What does pH measure?',
        options: ['Acidity', 'Mass', 'Temperature'],
        answer: 0,
      },
      {
        prompt: 'Which particle has a negative charge?',
        options: ['Proton', 'Electron', 'Neutron'],
        answer: 1,
      },
      {
        prompt: 'What is H2O?',
        options: ['Water', 'Salt', 'Oxygen'],
        answer: 0,
      },
    ],
  },
  {
    id: 'starter-math-plus',
    accent: '#8ad7ff',
    title: 'Plus Orb',
    category: 'math',
    rarity: 'Starter Signal',
    trait: 'Pattern Signal',
    journalNote: 'You learned that math uses patterns, operations, and structure to solve problems.',
    questions: [
      {
        prompt: 'What is 12 x 8?',
        options: ['96', '86', '108'],
        answer: 0,
      },
      {
        prompt: 'What is the square root of 81?',
        options: ['7', '9', '11'],
        answer: 1,
      },
      {
        prompt: 'A prime number has how many positive factors?',
        options: ['2', '3', '4'],
        answer: 0,
      },
    ],
  },
  {
    id: 'starter-geology-rock',
    accent: '#d6a86f',
    title: 'Granite Orb',
    category: 'geology',
    rarity: 'Starter Signal',
    trait: 'Earth Signal',
    journalNote: 'You learned that geology studies rocks, minerals, volcanoes, and Earth processes.',
    questions: [
      {
        prompt: 'What type of rock forms from cooled lava?',
        options: ['Igneous', 'Sedimentary', 'Metamorphic'],
        answer: 0,
      },
      {
        prompt: 'What scale measures earthquake magnitude?',
        options: ['Richter', 'Celsius', 'Beaufort'],
        answer: 0,
      },
      {
        prompt: 'What is magma called after it reaches the surface?',
        options: ['Lava', 'Quartz', 'Clay'],
        answer: 0,
      },
    ],
  },
  {
    id: 'starter-cs-laptop',
    accent: '#9fb7ff',
    title: 'Code Orb',
    category: 'computer-science',
    rarity: 'Starter Signal',
    trait: 'Code Signal',
    journalNote: 'You learned that computer science uses algorithms, data, and logic to build systems.',
    questions: [
      {
        prompt: 'What does CPU stand for?',
        options: ['Central Processing Unit', 'Code Power Utility', 'Computer Pixel Unit'],
        answer: 0,
      },
      {
        prompt: 'Which value is boolean?',
        options: ['True', '42.5', 'Paragraph'],
        answer: 0,
      },
      {
        prompt: 'What does an algorithm describe?',
        options: ['Steps to solve a problem', 'A screen color', 'A network cable'],
        answer: 0,
      },
    ],
  },
  {
    id: 'starter-biology-cell',
    accent: '#8ef7a2',
    title: 'Cell Orb',
    category: 'biology',
    rarity: 'Starter Signal',
    trait: 'Life Signal',
    journalNote: 'You learned that biology studies life, cells, organisms, and ecosystems.',
    questions: [
      { prompt: 'What do plants use for photosynthesis?', options: ['Sunlight', 'Plastic', 'Sound'], answer: 0 },
      { prompt: 'DNA stores what?', options: ['Genetic instructions', 'Blood pressure', 'Heat only'], answer: 0 },
      { prompt: 'What organ pumps blood?', options: ['Heart', 'Lung', 'Stomach'], answer: 0 },
    ],
  },
  {
    id: 'starter-space-planet',
    accent: '#c6a4ff',
    title: 'Planet Orb',
    category: 'space',
    rarity: 'Starter Signal',
    trait: 'Orbit Signal',
    journalNote: 'You learned that space science studies planets, stars, gravity, and galaxies.',
    questions: [
      { prompt: 'Which planet is known as the Red Planet?', options: ['Mars', 'Venus', 'Jupiter'], answer: 0 },
      { prompt: 'What force keeps planets in orbit?', options: ['Gravity', 'Friction', 'Sound'], answer: 0 },
      { prompt: 'What is the Sun?', options: ['A star', 'A moon', 'A comet'], answer: 0 },
    ],
  },
];

const startButton = document.querySelector('#start-ar');
const statusText = document.querySelector('#status');
const unsupportedPanel = document.querySelector('#unsupported');
const gamePanel = document.querySelector('#game-panel');
const gameGrip = document.querySelector('#game-grip');
const gameCount = document.querySelector('#game-count');
const gameHint = document.querySelector('#game-hint');
const gameList = document.querySelector('#game-list');
const topicForm = document.querySelector('#topic-form');
const topicInput = document.querySelector('#topic-input');
const topicMessages = document.querySelector('#topic-messages');
const topicGenerate = document.querySelector('#topic-generate');
const topicStatus = document.querySelector('#topic-status');
const radarSummary = document.querySelector('#radar-summary');
const radarList = document.querySelector('#radar-list');
const journalSummary = document.querySelector('#journal-summary');
const journalList = document.querySelector('#journal-list');
const journalDetail = document.querySelector('#journal-detail');
const profileSummary = document.querySelector('#profile-summary');
const profileProgress = document.querySelector('#profile-progress');
const profileLevel = document.querySelector('#profile-level');
const profileXp = document.querySelector('#profile-xp');
const profileStreak = document.querySelector('#profile-streak');
const profileNearest = document.querySelector('#profile-nearest');
const profileRank = document.querySelector('#profile-rank');
const profileDifficulty = document.querySelector('#profile-difficulty');
const leaderboardList = document.querySelector('#leaderboard-list');
const regenerateTopic = document.querySelector('#regenerate-topic');
const tabBar = document.querySelector('#tab-bar');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const closestArrow = document.querySelector('#closest-arrow');
const closestArrowIcon = document.querySelector('#closest-arrow-icon');
const closestArrowLabel = document.querySelector('#closest-arrow-label');
const xpToast = document.querySelector('#xp-toast');
const quizPanel = document.querySelector('#quiz-panel');
const quizTitle = document.querySelector('#quiz-title');
const quizStep = document.querySelector('#quiz-step');
const quizIntro = document.querySelector('#quiz-intro');
const quizPrompt = document.querySelector('#quiz-prompt');
const quizOptions = document.querySelector('#quiz-options');
const quizFeedback = document.querySelector('#quiz-feedback');
const quizClose = document.querySelector('#quiz-close');
const xrRoot = document.querySelector('#xr-root');

let scene;
let camera;
let renderer;
let controller;
let reticle;
let currentSession = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let collectibles = [];
let collectiblesSpawned = false;
let highlightedCollectible = null;
let activeQuiz = null;
let stableFloorFrames = 0;
let gamePanelTouchStartY = null;
let hasDepthOcclusion = false;
let activeMode = 'hunt';
let lastHudRefreshMs = 0;
let startInteractionInFlight = false;
let lastFloorY = 0;
let orbWaveIndex = 0;
let savedAnimalProgress = {};
let selectedJournalAnimalId = TRIVIA_COLLECTIBLES[0].id;
let currentTopicPrompt = 'general science';
let currentTopicSummary = 'Starter science, math, geology, coding, biology, and space quest.';
let topicReady = false;
let arSupported = false;
let generatingTopic = false;
let playerId = getOrCreatePlayerId();
let playerName = getOrCreatePlayerName();
let playerProfile = getDefaultProfile();
let leaderboard = [];

const selectionRaycaster = new THREE.Raycaster();
const selectionOrigin = new THREE.Vector3();
const selectionDirection = new THREE.Vector3();
const cameraWorldPosition = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

initScene();
void loadProgressState().then(() => {
  updateCollectionHud();
  updateModePanels();
});
void refreshPlayerProfile();
checkWebXRSupport();
updateCollectionHud();
setupGamePanelGestures();
setupTabBar();
setActiveMode('hunt');
updateModePanels();

startButton.addEventListener('pointerup', handleStartButtonInteraction);
startButton.addEventListener('touchend', handleStartButtonInteraction, { passive: false });
startButton.addEventListener('click', handleStartButtonInteraction);
quizClose.addEventListener('click', closeQuizPanel);
topicForm.addEventListener('submit', handleTopicSubmit);
regenerateTopic.addEventListener('click', openTopicRegenerator);

function openProgressDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(PROGRESS_STORE, { keyPath: 'id' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open progress database.'));
  });
}

async function loadProgressState() {
  try {
    const db = await openProgressDb();
    const transaction = db.transaction(PROGRESS_STORE, 'readonly');
    const store = transaction.objectStore(PROGRESS_STORE);
    const records = await requestToPromise(store.getAll());
    savedAnimalProgress = Object.fromEntries(records.map((record) => [record.id, record]));
    db.close();
  } catch (error) {
    console.warn('Progress database unavailable:', error.message);
  }
}

async function saveAnimalProgress(collectible) {
  const record = {
    id: collectible.item.id,
    title: collectible.item.title,
    collected: collectible.collected,
    collectedAt: collectible.collected ? new Date().toISOString() : (savedAnimalProgress[collectible.item.id]?.collectedAt || null),
    questionIndex: collectible.questionIndex,
    revealed: collectible.revealed,
    updatedAt: new Date().toISOString(),
  };

  savedAnimalProgress[collectible.item.id] = record;

  try {
    const db = await openProgressDb();
    const transaction = db.transaction(PROGRESS_STORE, 'readwrite');
    transaction.objectStore(PROGRESS_STORE).put(record);
    await transactionToPromise(transaction);
    db.close();
  } catch (error) {
    console.warn('Could not save progress:', error.message);
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function updateStartButtonState() {
  if (currentSession) {
    startButton.disabled = false;
    startButton.textContent = 'Exit AR';
    return;
  }

  if (!arSupported) {
    startButton.disabled = true;
    startButton.textContent = 'Checking AR...';
    return;
  }

  if (!topicReady) {
    startButton.disabled = true;
    startButton.textContent = 'Generate first';
    return;
  }

  startButton.disabled = false;
  startButton.textContent = 'Start AR';
}

async function handleTopicSubmit(event) {
  event.preventDefault();

  const topic = topicInput.value.trim();

  if (!topic || generatingTopic) {
    return;
  }

  await generateTopicQuest(topic, true);
}

async function generateTopicQuest(topic, resetExisting) {
  generatingTopic = true;
  topicGenerate.disabled = true;
  topicStatus.textContent = 'Generating topic orbs with AI...';
  appendTopicMessage('You', topic);
  appendTopicMessage('Quest AI', 'Building your AR quest.');

  try {
    const payload = await postApi('/api/generate-topic', {
      topic,
      count: 6,
      difficulty: playerProfile.difficulty,
      accuracy: playerProfile.answersTotal ? playerProfile.answersCorrect / playerProfile.answersTotal : 0.7,
    });
    applyGeneratedTopic(payload, resetExisting);
    topicStatus.textContent = `${payload.orbs.length} ${payload.topic} orbs ready. You can Start AR.`;
    appendTopicMessage('Quest AI', payload.summary || `Generated ${payload.orbs.length} orbs.`);
  } catch (error) {
    topicStatus.textContent = 'Could not generate topic right now. Try again.';
    appendTopicMessage('Quest AI', `Generation failed: ${error.message}`);
  } finally {
    generatingTopic = false;
    topicGenerate.disabled = false;
    updateStartButtonState();
  }
}

function appendTopicMessage(sender, message) {
  const entry = document.createElement('p');
  const strong = document.createElement('strong');
  strong.textContent = `${sender}: `;
  entry.append(strong, message);
  topicMessages.appendChild(entry);
  topicMessages.scrollTop = topicMessages.scrollHeight;
}

function applyGeneratedTopic(payload, resetExisting) {
  const orbs = Array.isArray(payload?.orbs) ? payload.orbs.map(normalizeGeneratedOrbForClient).filter(Boolean) : [];

  if (!orbs.length) {
    throw new Error('No valid orbs returned.');
  }

  TRIVIA_COLLECTIBLES = orbs;
  TOTAL_COLLECTIBLES = orbs.length;
  selectedJournalAnimalId = orbs[0].id;
  currentTopicPrompt = payload.topic || currentTopicPrompt;
  currentTopicSummary = payload.summary || currentTopicSummary;
  topicReady = true;

  if (resetExisting && collectiblesSpawned) {
    resetCollectibles();
  }

  updateCollectionHud();
  updateModePanels();
}

function normalizeGeneratedOrbForClient(orb) {
  if (!orb?.id || !orb?.title || !Array.isArray(orb.questions) || orb.questions.length < 3) {
    return null;
  }

  return {
    ...orb,
    category: normalizeClientCategory(orb.category || orb.title),
    accent: /^#[0-9a-fA-F]{6}$/.test(orb.accent || '') ? orb.accent : '#79f0c2',
    rarity: orb.rarity || 'Generated Quest',
    trait: orb.trait || 'Topic Signal',
    journalNote: orb.journalNote || `You learned a ${currentTopicPrompt} idea from this orb.`,
  };
}

function normalizeClientCategory(value) {
  const text = String(value || '').toLowerCase();
  if (/chem|atom|molecule|reaction|flask/.test(text)) return 'chemistry';
  if (/math|algebra|geometry|calculus|number|equation/.test(text)) return 'math';
  if (/geo|rock|earth|volcano|mineral|fossil/.test(text)) return 'geology';
  if (/computer|code|program|software|algorithm|ai|data/.test(text)) return 'computer-science';
  if (/bio|cell|plant|life|dna/.test(text)) return 'biology';
  if (/history|war|empire|ancient|civilization/.test(text)) return 'history';
  if (/space|planet|star|galaxy|astronomy/.test(text)) return 'space';
  if (/art|paint|music|design|color/.test(text)) return 'art';
  if (/literature|book|poem|story|novel/.test(text)) return 'literature';
  return 'general';
}

async function openTopicRegenerator() {
  if (currentSession) {
    await currentSession.end();
  }

  topicInput.focus();
  topicStatus.textContent = 'Enter a new topic to regenerate your AR orbs.';
}

function getOrCreatePlayerId() {
  const existing = localStorage.getItem(PLAYER_ID_KEY);

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

function getOrCreatePlayerName() {
  const existing = localStorage.getItem(PLAYER_NAME_KEY);

  if (existing) {
    return existing;
  }

  const name = `Explorer ${playerId.slice(-4).toUpperCase()}`;
  localStorage.setItem(PLAYER_NAME_KEY, name);
  return name;
}

function getDefaultProfile() {
  const saved = localStorage.getItem(LOCAL_PROFILE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(LOCAL_PROFILE_KEY);
    }
  }

  return decorateClientProfile({
    id: playerId,
    name: playerName,
    xp: 0,
    level: 1,
    streak: 0,
    bestStreak: 0,
    answersCorrect: 0,
    answersTotal: 0,
    animalCount: 0,
    difficulty: 'Easy',
  });
}

async function refreshPlayerProfile() {
  try {
    const payload = await apiFetch(`/api/profile?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}`);
    applyProfilePayload(payload);
  } catch (error) {
    console.warn('Profile API unavailable, using local profile:', error.message);
    updateModePanels();
  }
}

async function recordAnswerEvent(correct, collectible, questionIndex) {
  const payload = await postApi('/api/answer', {
    playerId,
    name: playerName,
    animalId: collectible.item.id,
    questionIndex,
    correct,
  }).catch(() => applyLocalAnswerEvent(correct, questionIndex));

  applyProfilePayload(payload);
  showXpToast(payload.xpGained || 0, payload.leveledUp, payload.profile?.level);
  return payload;
}

async function recordCollectionEvent(collectible) {
  const payload = await postApi('/api/collect', {
    playerId,
    name: playerName,
    animalId: collectible.item.id,
  }).catch(() => applyLocalCollectionEvent(collectible.item.id));

  applyProfilePayload(payload);
  showXpToast(payload.xpGained || 0, payload.leveledUp, payload.profile?.level);
  return payload;
}

async function apiFetch(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json();
}

async function postApi(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.json();
}

function applyProfilePayload(payload) {
  if (payload?.profile) {
    playerProfile = decorateClientProfile(payload.profile);
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
  }

  if (payload?.leaderboard) {
    leaderboard = payload.leaderboard;
  }

  updateModePanels();
}

function applyLocalAnswerEvent(correct, questionIndex) {
  const previousLevel = playerProfile.level;
  let xpGained = 0;
  const nextProfile = { ...playerProfile };
  nextProfile.answersTotal += 1;

  if (correct) {
    nextProfile.answersCorrect += 1;
    nextProfile.streak += 1;
    nextProfile.bestStreak = Math.max(nextProfile.bestStreak, nextProfile.streak);
    xpGained = getClientAnswerXp(nextProfile.level, nextProfile.streak, questionIndex);
    nextProfile.xp += xpGained;
  } else {
    nextProfile.streak = 0;
  }

  playerProfile = decorateClientProfile(nextProfile);
  leaderboard = [{ rank: 1, ...playerProfile }];
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
  return { profile: playerProfile, leaderboard, xpGained, leveledUp: playerProfile.level > previousLevel, correct };
}

function applyLocalCollectionEvent(animalId) {
  const previousLevel = playerProfile.level;
  const animalsCollected = { ...(playerProfile.animalsCollected || {}) };
  const alreadyCollected = Boolean(animalsCollected[animalId]);
  const xpGained = alreadyCollected ? 0 : 70 + Math.min(playerProfile.level * 5, 60);

  if (!alreadyCollected) {
    animalsCollected[animalId] = new Date().toISOString();
  }

  playerProfile = decorateClientProfile({
    ...playerProfile,
    xp: playerProfile.xp + xpGained,
    animalsCollected,
    animalCount: Object.keys(animalsCollected).length,
  });
  leaderboard = [{ rank: 1, ...playerProfile }];
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
  return { profile: playerProfile, leaderboard, xpGained, leveledUp: playerProfile.level > previousLevel };
}

function decorateClientProfile(profile) {
  const level = getClientLevelForXp(profile.xp || 0);
  const currentLevelXp = getClientXpForLevel(level);
  const nextLevelXp = getClientXpForLevel(level + 1);
  const xpIntoLevel = (profile.xp || 0) - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;

  return {
    ...profile,
    level,
    xpIntoLevel,
    xpForNextLevel,
    nextLevelXp,
    difficulty: profile.difficulty || getClientDifficultyForLevel(level),
  };
}

function getClientAnswerXp(level, streak, questionIndex) {
  return 22 + Math.min(level * 2, 24) + Math.min(streak * 4, 40) + Math.max(questionIndex, 0) * 3;
}

function getClientLevelForXp(xp) {
  let level = 1;

  while (xp >= getClientXpForLevel(level + 1)) {
    level += 1;
  }

  return level;
}

function getClientXpForLevel(level) {
  if (level <= 1) {
    return 0;
  }

  return Math.round(120 * (level - 1) + 70 * (level - 1) ** 2);
}

function getClientDifficultyForLevel(level) {
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

function showXpToast(xpGained, leveledUp, level) {
  if (!xpGained && !leveledUp) {
    return;
  }

  xpToast.textContent = leveledUp ? `Level ${level}! +${xpGained} XP` : `+${xpGained} XP`;
  xpToast.classList.remove('hidden', 'is-visible', 'is-level-up');
  void xpToast.offsetWidth;
  xpToast.classList.add('is-visible');

  if (leveledUp) {
    xpToast.classList.add('is-level-up');
  }

  window.setTimeout(() => {
    xpToast.classList.remove('is-visible', 'is-level-up');
    xpToast.classList.add('hidden');
  }, 1700);
}

function handleStartButtonInteraction(event) {
  if (event.type === 'touchend') {
    event.preventDefault();
  }

  if (startButton.disabled || startInteractionInFlight) {
    return;
  }

  if (!topicReady && !currentSession) {
    topicStatus.textContent = 'Generate topic orbs before entering AR.';
    return;
  }

  startInteractionInFlight = true;
  statusText.textContent = currentSession ? 'Closing AR session...' : 'Start button pressed. Opening AR...';
  void startARSession().finally(() => {
    startInteractionInFlight = false;
  });
}

function initScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.className = 'xr-canvas';
  xrRoot.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2b2b2b, 1.6));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(2, 4, 2);
  scene.add(keyLight);

  reticle = createReticle();
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', handleARSelect);
  scene.add(controller);

  window.addEventListener('resize', handleResize);
}

async function checkWebXRSupport() {
  const userAgent = navigator.userAgent;

  if (/GSA|; wv\)/i.test(userAgent)) {
    statusText.textContent = 'Open this URL in the Chrome app, not the Google app or an in-app browser.';
  }

  if (!('xr' in navigator)) {
    showUnsupported('This browser does not expose navigator.xr. Use Android Chrome on a supported ARCore device.');
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');

    if (!supported) {
      showUnsupported('Immersive WebXR AR is unavailable on this device or browser.');
      return;
    }

    arSupported = true;
    updateStartButtonState();

    if (!/GSA|; wv\)/i.test(userAgent)) {
      statusText.textContent = 'Generate a topic quest, then Start AR and scan the floor.';
    }
  } catch (error) {
    showUnsupported(`Could not check WebXR support: ${error.message}`);
  }
}

async function startARSession() {
  if (currentSession) {
    await currentSession.end();
    return;
  }

  try {
    startButton.disabled = true;
    startButton.textContent = 'Starting...';
    statusText.textContent = 'Requesting camera-based AR session...';
    renderer.xr.setReferenceSpaceType('local');

    const session = await requestARSession();
    currentSession = session;
    hasDepthOcclusion = false;
    document.body.classList.add('is-ar-active');
    session.addEventListener('end', endARSession);

    await renderer.xr.setSession(session);
    renderer.setAnimationLoop(render);

    gamePanel.classList.remove('hidden');
    tabBar.classList.remove('hidden');
    stableFloorFrames = 0;
    lastHudRefreshMs = 0;
    setActiveMode('hunt');
    startButton.disabled = false;
    updateStartButtonState();
    statusText.textContent = 'Move your phone slowly to find the floor.';
  } catch (error) {
    updateStartButtonState();
    statusText.textContent = `AR could not start: ${error.message}`;
  }
}

async function requestARSession() {
  const optionsWithOverlay = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body },
  };

  try {
    return await navigator.xr.requestSession('immersive-ar', optionsWithOverlay);
  } catch (firstError) {
    statusText.textContent = 'Retrying AR without DOM Overlay...';

    try {
      return await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
      });
    } catch (secondError) {
      throw new Error(`${secondError.message || secondError.name}. First attempt: ${firstError.message || firstError.name}`);
    }
  }
}

function endARSession() {
  currentSession = null;
  hasDepthOcclusion = false;
  hitTestSource = null;
  hitTestSourceRequested = false;
  stableFloorFrames = 0;
  reticle.visible = false;
  resetCollectibles();
  closeQuizPanel();
  gamePanel.classList.add('hidden');
  gamePanel.classList.remove('is-expanded');
  tabBar.classList.add('hidden');
  renderer.setAnimationLoop(null);
  document.body.classList.remove('is-ar-active');
  updateStartButtonState();
  statusText.textContent = 'AR ended. Start again to deploy the trivia hunt.';
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource && !collectiblesSpawned) {
      const hitResults = frame.getHitTestResults(hitTestSource);

      if (hitResults.length > 0) {
        const hit = hitResults[0];
        const pose = hit.getPose(referenceSpace);

        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        stableFloorFrames += 1;

        if (stableFloorFrames < 8) {
          statusText.textContent = 'Floor found. Hold steady while the hunt map settles.';
        } else {
          spawnCollectiblesFromReticle();
        }
      } else {
        reticle.visible = false;
        stableFloorFrames = 0;
        statusText.textContent = 'Searching for a floor. Move your phone slowly.';
      }
    }
  }

  updateCollectibles(performance.now() * 0.001);

  if (timestamp - lastHudRefreshMs > 220) {
    updateModePanels();
    lastHudRefreshMs = timestamp;
  }

  renderer.render(scene, camera);
}

function handleARSelect() {
  if (activeQuiz) {
    return;
  }

  if (!collectiblesSpawned) {
    statusText.textContent = stableFloorFrames > 0 ? 'Hold steady. The hidden topic orbs are being placed across the route.' : 'Move your phone slowly until the floor is found.';
    return;
  }

  const collectible = getCenteredCollectible();

  if (!collectible) {
    const nearest = getNearestCollectible();
    if (nearest) {
      const nearestDistance = getCollectibleDistance(nearest);
      statusText.textContent = nearestDistance > REVEAL_DISTANCE_METERS
        ? `No orb visible yet. Closest signal is ${formatDistance(nearestDistance)} away; walk ${formatDistance(nearestDistance - REVEAL_DISTANCE_METERS)} closer to reveal it.`
        : 'An orb is nearby. Look around, center the visible orb, then tap it.';
    } else {
      statusText.textContent = 'All orbs completed.';
    }
    return;
  }

  const distance = getCollectibleDistance(collectible);

  if (distance > INTERACTION_DISTANCE_METERS) {
    const remainingDistance = distance - INTERACTION_DISTANCE_METERS;
    statusText.textContent = `${collectible.item.title} is ${formatDistance(distance)} away. Walk ${formatDistance(remainingDistance)} closer, then tap it.`;
    gameHint.textContent = `Keep ${collectible.item.title} centered and walk closer. You must be within ${formatDistance(INTERACTION_DISTANCE_METERS)} to start the quiz.`;
    return;
  }

  openQuizForCollectible(collectible);
}

function spawnCollectiblesFromReticle() {
  if (!reticle.visible || collectiblesSpawned || !topicReady) {
    return;
  }

  resetCollectibles();

  const floorPosition = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
  lastFloorY = floorPosition.y;
  spawnCollectiblesNearPlayer(floorPosition.y);
}

function spawnCollectiblesNearPlayer(floorY) {
  camera.getWorldPosition(cameraWorldPosition);
  const playerBase = new THREE.Vector3(cameraWorldPosition.x, floorY, cameraWorldPosition.z);
  const heading = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  heading.y = 0;

  if (heading.lengthSq() < 0.0001) {
    heading.set(0, 0, -1);
  }

  heading.normalize();
  const right = new THREE.Vector3().crossVectors(heading, upAxis).normalize().negate();
  const spawnSlots = shuffleArray(createSpawnSlots(TOTAL_COLLECTIBLES));

  collectibles = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).map((item, index) => {
    const slot = spawnSlots[index % spawnSlots.length];
    const angle = slot.angle + (Math.random() - 0.5) * 0.08;
    const distance = slot.distance + (Math.random() - 0.5) * 0.24;
    const offset = heading.clone().multiplyScalar(Math.cos(angle) * distance).add(right.clone().multiplyScalar(Math.sin(angle) * distance));
    const position = playerBase.clone().add(offset);
    position.y = floorY;

    const collectible = createCollectible(item, position);
    scene.add(collectible.group);
    return collectible;
  });

  collectiblesSpawned = true;
  stableFloorFrames = 0;
  reticle.visible = false;
  updateCollectionHud();
  statusText.textContent = `${TOTAL_COLLECTIBLES} topic orbs spawned across the route. Follow the arrow and walk close until an orb appears.`;
}

function createSpawnSlots(count) {
  const slotCount = Math.max(count, 1);
  return Array.from({ length: slotCount }, (_, index) => {
    const progress = slotCount === 1 ? 0.5 : index / (slotCount - 1);
    const angle = THREE.MathUtils.lerp(-1.05, 1.05, progress) + (index % 2 === 0 ? -0.18 : 0.18);
    const distance = 5.4 + index * 2.2;
    return { angle, distance };
  });
}

function createCollectible(item, groundPosition) {
  const progress = savedAnimalProgress[item.id] || {};
  const group = new THREE.Group();
  group.position.copy(groundPosition);
  group.visible = false;

  const floatRig = new THREE.Group();
  floatRig.position.y = COLLECTIBLE_HEIGHT;
  group.add(floatRig);

  const shadow = createCollectibleShadow();
  group.add(shadow);

  const groundRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.022, 16, 48),
    new THREE.MeshBasicMaterial({ color: item.accent, transparent: true, opacity: 0.78 }),
  );
  groundRing.rotation.x = Math.PI / 2;
  groundRing.position.y = 0.015;
  group.add(groundRing);

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.11, 1.7, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color: item.accent,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beacon.position.y = 0.86;
  group.add(beacon);

  const orbModel = createTopicOrbModel(item);
  orbModel.scale.setScalar(0.76);
  floatRig.add(orbModel);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: item.accent,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.024, 16, 56), haloMaterial);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.27;
  floatRig.add(halo);

  const cardTexture = createCollectibleTexture(item);
  const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture, transparent: true, side: THREE.DoubleSide });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.28), cardMaterial);
  card.position.y = 0.72;
  floatRig.add(card);

  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.35),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  hitArea.position.y = 0.32;
  floatRig.add(hitArea);

  return {
    card,
    collected: Boolean(progress.collected),
    beacon,
    floatRig,
    group,
    groundRing,
    halo,
    hitArea,
    item,
    orbModel,
    questionIndex: Math.min(progress.questionIndex || 0, item.questions.length),
    revealed: Boolean(progress.revealed || progress.collected),
    worldBaseY: COLLECTIBLE_HEIGHT,
    bobOffset: Math.random() * Math.PI * 2,
  };
}

function createTopicOrbModel(item) {
  const group = new THREE.Group();
  const accent = new THREE.Color(item.accent || '#79f0c2');
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.08,
    roughness: 0.42,
    metalness: 0.12,
    transparent: true,
    opacity: 0.92,
  });
  const symbolMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fbff, emissive: accent, emissiveIntensity: 0.16, roughness: 0.48 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x071020, roughness: 0.66 });

  addSphere(group, coreMaterial, [0, 0.12, 0], [0.34, 0.34, 0.34]);

  const shell = new THREE.Mesh(
    new THREE.TorusGeometry(0.39, 0.012, 12, 72),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.88 }),
  );
  shell.rotation.set(Math.PI / 2, 0.2, 0.15);
  shell.position.y = 0.12;
  group.add(shell);

  addCategoryGlyph(group, item.category, symbolMaterial, darkMaterial, accent);
  return group;
}

function addCategoryGlyph(group, category, material, darkMaterial, accent) {
  switch (normalizeClientCategory(category)) {
    case 'chemistry':
      addCylinder(group, material, [0, 0.29, 0.26], [0.035, 0.035, 0.22], 0, 0, 0);
      addCylinder(group, material, [0, 0.13, 0.27], [0.12, 0.12, 0.2], 0, 0, 0);
      addSphere(group, new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.18, roughness: 0.35 }), [0, 0.05, 0.27], [0.1, 0.04, 0.1]);
      break;
    case 'math':
      addBox(group, material, [0, 0.13, 0.32], [0.32, 0.055, 0.055]);
      addBox(group, material, [0, 0.13, 0.32], [0.055, 0.32, 0.055]);
      break;
    case 'geology':
      addRock(group, material, [0, 0.12, 0.28]);
      break;
    case 'computer-science':
      addBox(group, darkMaterial, [0, 0.14, 0.29], [0.3, 0.18, 0.035]);
      addBox(group, material, [0, 0.25, 0.28], [0.24, 0.015, 0.035]);
      addBox(group, material, [0, 0.02, 0.32], [0.36, 0.035, 0.18]);
      break;
    case 'biology':
      for (let index = 0; index < 6; index += 1) {
        const y = -0.04 + index * 0.07;
        const x = Math.sin(index * 1.2) * 0.12;
        addSphere(group, material, [x, y + 0.1, 0.32], [0.035, 0.035, 0.035]);
        addSphere(group, material, [-x, y + 0.1, 0.32], [0.035, 0.035, 0.035]);
        addCylinder(group, material, [0, y + 0.1, 0.32], [0.012, 0.012, Math.max(Math.abs(x) * 2, 0.06)], Math.PI / 2, 0, Math.PI / 2);
      }
      break;
    case 'space': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 12, 54), material);
      ring.rotation.set(Math.PI / 2.9, 0, -0.38);
      ring.position.set(0, 0.12, 0.28);
      group.add(ring);
      addSphere(group, material, [0, 0.12, 0.32], [0.12, 0.12, 0.12]);
      break;
    }
    case 'history':
      addCylinder(group, material, [0, 0.1, 0.3], [0.06, 0.06, 0.28], 0, 0, 0);
      addBox(group, material, [0, 0.27, 0.3], [0.28, 0.04, 0.08]);
      addBox(group, material, [0, -0.07, 0.3], [0.3, 0.04, 0.09]);
      break;
    case 'art':
      addSphere(group, material, [0, 0.12, 0.29], [0.18, 0.12, 0.04]);
      addSphere(group, darkMaterial, [0.08, 0.17, 0.34], [0.025, 0.025, 0.012]);
      addSphere(group, darkMaterial, [-0.05, 0.09, 0.34], [0.02, 0.02, 0.012]);
      addSphere(group, darkMaterial, [0.01, 0.2, 0.34], [0.018, 0.018, 0.012]);
      break;
    case 'literature':
      addBox(group, darkMaterial, [-0.06, 0.12, 0.3], [0.15, 0.24, 0.035]);
      addBox(group, material, [0.06, 0.12, 0.31], [0.15, 0.24, 0.035]);
      addBox(group, material, [0, 0.12, 0.34], [0.022, 0.24, 0.02]);
      break;
    default:
      addBox(group, material, [0, 0.13, 0.31], [0.24, 0.06, 0.06]);
      addBox(group, material, [0, 0.13, 0.31], [0.06, 0.24, 0.06]);
      addBox(group, material, [0, 0.13, 0.31], [0.06, 0.06, 0.24]);
      break;
  }
}

function addRock(group, material, position) {
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), material);
  mesh.position.set(...position);
  mesh.scale.set(1.1, 0.82, 0.72);
  mesh.rotation.set(0.35, 0.2, -0.18);
  group.add(mesh);
  return mesh;
}

function addSphere(group, material, position, scale) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

function addCylinder(group, material, position, scale, rotateX, rotateY, rotateZ) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(rotateX, rotateY, rotateZ);
  group.add(mesh);
  return mesh;
}

function addBox(group, material, position, scale) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

function createCollectibleTexture(item) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  context.fillStyle = '#08111f';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = item.accent;
  context.lineWidth = 12;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.fillStyle = '#ffffff';
  context.font = '800 58px Arial';
  context.fillText(item.title, canvas.width / 2, 92);

  context.fillStyle = 'rgba(255,255,255,0.84)';
  context.font = '600 30px Arial';
  context.fillText('Walk Close + Tap', canvas.width / 2, 154);

  context.fillStyle = item.accent;
  context.font = '700 24px Arial';
  context.fillText('3 questions to complete orb', canvas.width / 2, 204);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function updateCollectibles(timeSeconds) {
  if (!collectiblesSpawned) {
    return;
  }

  camera.getWorldPosition(cameraWorldPosition);
  highlightedCollectible = getCenteredCollectible();

  collectibles.forEach((collectible) => {
    if (collectible.collected) {
      collectible.group.visible = false;
      return;
    }

    const distance = getCollectibleDistance(collectible);
    if (!collectible.revealed && distance <= REVEAL_DISTANCE_METERS) {
      collectible.revealed = true;
      void saveAnimalProgress(collectible);
    }

    collectible.group.visible = collectible.revealed;

    if (!collectible.revealed) {
      return;
    }

    const bob = Math.sin(timeSeconds * 1.5 + collectible.bobOffset) * 0.08;
    collectible.floatRig.position.y = collectible.worldBaseY + bob;
    collectible.orbModel.rotation.y += 0.012;
    collectible.halo.rotation.z += 0.01;
    collectible.card.lookAt(cameraWorldPosition);
    collectible.hitArea.lookAt(cameraWorldPosition);

    const isHighlighted = collectible === highlightedCollectible;
    collectible.floatRig.scale.setScalar(isHighlighted ? 1.08 : 1);
    collectible.orbModel.traverse((child) => {
      if (child.material?.emissiveIntensity !== undefined) {
        child.material.emissiveIntensity = isHighlighted ? 0.12 : 0.02;
      }
    });
    collectible.halo.material.opacity = isHighlighted ? 0.95 : 0.7;
    collectible.beacon.material.opacity = isHighlighted ? 0.26 : 0.16;
    collectible.groundRing.material.opacity = isHighlighted ? 1 : 0.78;
  });
}

function getCenteredCollectible() {
  const activeCollectibles = collectibles.filter((collectible) => !collectible.collected && collectible.revealed);

  if (!activeCollectibles.length) {
    return null;
  }

  camera.getWorldPosition(selectionOrigin);
  selectionDirection.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  selectionRaycaster.set(selectionOrigin, selectionDirection);

  const intersections = selectionRaycaster.intersectObjects(
    activeCollectibles.map((collectible) => collectible.hitArea),
    false,
  );

  if (!intersections.length) {
    return null;
  }

  return activeCollectibles.find((collectible) => collectible.hitArea === intersections[0].object) || null;
}

function openQuizForCollectible(collectible) {
  activeQuiz = collectible;
  quizFeedback.textContent = '';
  renderQuizQuestion();
  quizPanel.classList.remove('hidden');
  gameHint.textContent = `You found ${collectible.item.title}. Answer all 3 questions to collect it.`;
  statusText.textContent = `${collectible.item.title} is ready for you.`;
}

function renderQuizQuestion() {
  const collectible = activeQuiz;
  const question = collectible.item.questions[collectible.questionIndex];

  quizTitle.textContent = `You found ${collectible.item.title}`;
  quizStep.textContent = `Question ${collectible.questionIndex + 1} of ${collectible.item.questions.length}`;
  quizIntro.textContent = 'Keep your streak going. Get all 3 right to complete this orb.';
  quizPrompt.textContent = question.prompt;
  quizOptions.replaceChildren();

  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.textContent = option;
    button.addEventListener('click', () => handleQuizAnswer(index));
    quizOptions.appendChild(button);
  });
}

async function handleQuizAnswer(answerIndex) {
  const collectible = activeQuiz;

  if (!collectible) {
    return;
  }

  const question = collectible.item.questions[collectible.questionIndex];
  const questionIndex = collectible.questionIndex;

  if (answerIndex !== question.answer) {
    quizFeedback.textContent = 'Not quite. Take another shot, you are still in it.';
    await recordAnswerEvent(false, collectible, questionIndex);
    return;
  }

  await recordAnswerEvent(true, collectible, questionIndex);
  collectible.questionIndex += 1;
  void saveAnimalProgress(collectible);

  if (collectible.questionIndex >= collectible.item.questions.length) {
    collectCollectible(collectible);
    return;
  }

  quizFeedback.textContent = `Nice. ${collectible.item.questions.length - collectible.questionIndex} more to go.`;
  renderQuizQuestion();
}

function collectCollectible(collectible) {
  collectible.collected = true;
  collectible.group.visible = false;
  activeQuiz = null;
  quizPanel.classList.add('hidden');
  quizFeedback.textContent = '';
  updateCollectionHud();
  updateModePanels();
  void saveAnimalProgress(collectible);
  void recordCollectionEvent(collectible);

  if (getCollectedCount() === TOTAL_COLLECTIBLES) {
    gameHint.textContent = 'Wave complete. Generating the next topic orb wave...';
    statusText.textContent = 'Wave complete. Generating more orbs.';
    void startNextOrbWave();
    return;
  }

  gameHint.textContent = `${collectible.item.title} is yours. Keep walking; the remaining orbs stay hidden until you get close.`;
  statusText.textContent = `${collectible.item.title} collected. Use Radar and keep walking to reveal the others.`;
}

async function startNextOrbWave() {
  orbWaveIndex += 1;

  try {
    const payload = await postApi('/api/generate-topic', {
      topic: currentTopicPrompt,
      count: 6,
      difficulty: playerProfile.difficulty,
      accuracy: playerProfile.answersTotal ? playerProfile.answersCorrect / playerProfile.answersTotal : 0.7,
    });
    applyGeneratedTopic(withWaveOrbIds(payload, orbWaveIndex), false);
  } catch (error) {
    console.warn('Could not generate next wave:', error.message);
    TRIVIA_COLLECTIBLES = TRIVIA_COLLECTIBLES.map((item, index) => ({
      ...item,
      id: `${item.id}-wave-${orbWaveIndex}-${index}`,
    }));
  }

  resetCollectibles();
  spawnCollectiblesNearPlayer(lastFloorY);
}

function withWaveOrbIds(payload, waveIndex) {
  return {
    ...payload,
    orbs: Array.isArray(payload?.orbs)
      ? payload.orbs.map((orb, index) => ({
          ...orb,
          id: `${orb.id || 'orb'}-wave-${waveIndex}-${index}`,
        }))
      : [],
  };
}

function closeQuizPanel() {
  activeQuiz = null;
  quizPanel.classList.add('hidden');
  quizFeedback.textContent = '';

  if (collectiblesSpawned && getCollectedCount() < TOTAL_COLLECTIBLES) {
    gameHint.textContent = `Use Radar distance. Orbs reveal inside ${formatDistance(REVEAL_DISTANCE_METERS)}; get within ${formatDistance(INTERACTION_DISTANCE_METERS)}, center, and tap.`;
  }
}

function updateCollectionHud() {
  const collectedCount = getCollectedCount();
  gameCount.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES} collected`;
  renderCollectibleList();

  if (!collectiblesSpawned) {
    gameHint.textContent = `Find the floor first. ${TOTAL_COLLECTIBLES} hidden topic orbs will be placed across a walking route.`;
    return;
  }

  if (collectedCount === TOTAL_COLLECTIBLES) {
    gameHint.textContent = 'All topic orbs completed. Generating more...';
    return;
  }

  gameHint.textContent = `Use Radar distance. Orbs reveal inside ${formatDistance(REVEAL_DISTANCE_METERS)}; get within ${formatDistance(INTERACTION_DISTANCE_METERS)}, center, and tap.`;
}

function setupGamePanelGestures() {
  gameGrip.addEventListener('click', toggleGamePanelExpansion);
  gamePanel.addEventListener('touchstart', handleGamePanelTouchStart, { passive: true });
  gamePanel.addEventListener('touchend', handleGamePanelTouchEnd, { passive: true });
}

function setupTabBar() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveMode(button.dataset.mode);
      gamePanel.classList.add('is-expanded');
    });
  });
}

function handleGamePanelTouchStart(event) {
  gamePanelTouchStartY = event.changedTouches[0]?.clientY ?? null;
}

function handleGamePanelTouchEnd(event) {
  if (gamePanelTouchStartY === null) {
    return;
  }

  const touchEndY = event.changedTouches[0]?.clientY ?? gamePanelTouchStartY;
  const deltaY = gamePanelTouchStartY - touchEndY;
  gamePanelTouchStartY = null;

  if (deltaY > 36) {
    gamePanel.classList.add('is-expanded');
    return;
  }

  if (deltaY < -36) {
    gamePanel.classList.remove('is-expanded');
  }
}

function toggleGamePanelExpansion() {
  gamePanel.classList.toggle('is-expanded');
}

function setActiveMode(mode) {
  activeMode = mode;

  document.querySelectorAll('.mode-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `mode-${mode}`);
  });

  tabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
}

function updateModePanels() {
  updateRadarPanel();
  updateJournalPanel();
  updateProfilePanel();
  updateClosestArrow();
}

function updateClosestArrow() {
  if (!collectiblesSpawned || activeQuiz) {
    closestArrow.classList.add('hidden');
    return;
  }

  const nearest = getNearestCollectible();

  if (!nearest) {
    closestArrow.classList.add('hidden');
    return;
  }

  const angle = getCollectibleScreenAngleDegrees(nearest);
  closestArrowIcon.textContent = '↑';
  closestArrowIcon.style.transform = `rotate(${angle}deg)`;
  closestArrowLabel.textContent = `${nearest.item.title} ${formatDistance(getCollectibleDistance(nearest))}`;
  closestArrow.classList.remove('hidden');
}

function updateRadarPanel() {
  if (!collectiblesSpawned) {
    radarSummary.textContent = 'Waiting for the floor lock so the radar can pick up signals.';
    radarList.replaceChildren();
    return;
  }

  const nearest = getNearestCollectible();
  radarSummary.textContent = nearest
    ? `Follow the arrow to ${nearest.item.title}. Visible near ${formatDistance(REVEAL_DISTANCE_METERS)}, tappable near ${formatDistance(INTERACTION_DISTANCE_METERS)}.`
    : 'All signals collected.';

  radarList.replaceChildren();

  if (!nearest) {
    const cleared = document.createElement('strong');
    cleared.textContent = 'Route cleared';
    radarList.appendChild(cleared);
    return;
  }

  const distance = getCollectibleDistance(nearest);
  const angle = getCollectibleScreenAngleDegrees(nearest);
  const arrowWrap = document.createElement('div');
  arrowWrap.className = 'radar-compass__bubble';

  const arrow = document.createElement('span');
  arrow.className = 'radar-compass__arrow';
  arrow.textContent = '↑';
  arrow.style.transform = `rotate(${angle}deg)`;

  const distanceLabel = document.createElement('strong');
  distanceLabel.textContent = `${formatDistance(distance)} away`;

  const targetLabel = document.createElement('span');
  targetLabel.textContent = nearest.item.title;

  arrowWrap.appendChild(arrow);
  radarList.append(arrowWrap, distanceLabel, targetLabel);
}

function updateJournalPanel() {
  const collectedCount = getCollectedCount();
  const lifetimeCollectedCount = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).filter((item) => getProgressForItem(item).collected).length;
  journalSummary.textContent = lifetimeCollectedCount
    ? `Achievement chart ${Math.round((lifetimeCollectedCount / TOTAL_COLLECTIBLES) * 100)}% complete. ${lifetimeCollectedCount} of ${TOTAL_COLLECTIBLES} orbs logged.`
    : 'Tap an achievement square to inspect it. Finished orbs unlock what you learned.';

  journalList.replaceChildren();
  journalList.classList.add('achievement-grid');

  TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).forEach((item, index) => {
    const progress = getProgressForItem(item);
    const collected = Boolean(progress.collected);
    const answeredCount = collected ? item.questions.length : (progress.questionIndex || 0);
    const progressPercent = Math.round((answeredCount / item.questions.length) * 100);
    const listItem = document.createElement('li');
    listItem.className = `achievement-card ${collected ? 'is-collected' : 'is-locked'} ${selectedJournalAnimalId === item.id ? 'is-selected' : ''}`;
    listItem.style.setProperty('--accent', item.accent);
    listItem.tabIndex = 0;
    listItem.setAttribute('role', 'button');
    listItem.setAttribute('aria-label', `${item.title} achievement ${collected ? 'complete' : 'locked'}`);

    const badge = document.createElement('div');
    badge.className = 'achievement-card__badge';
    badge.textContent = String(index + 1).padStart(3, '0');

    const title = document.createElement('strong');
    title.textContent = item.title;

    const state = document.createElement('span');
    state.className = 'achievement-card__state';
    if (collected) {
      state.textContent = 'Done';
    } else if (answeredCount > 0) {
      state.textContent = `${answeredCount}/${item.questions.length} quiz`;
    } else if (progress.revealed) {
      state.textContent = 'Found';
    } else {
      state.textContent = 'Locked';
    }

    const progressBar = document.createElement('div');
    progressBar.className = 'achievement-card__progress';

    const progressFill = document.createElement('div');
    progressFill.style.width = `${progressPercent}%`;

    progressBar.appendChild(progressFill);
    listItem.append(badge, title, state, progressBar);
    listItem.addEventListener('click', () => selectJournalAnimal(item.id));
    listItem.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectJournalAnimal(item.id);
      }
    });
    journalList.appendChild(listItem);
  });

  renderJournalDetail();
}

function selectJournalAnimal(itemId) {
  selectedJournalAnimalId = itemId;
  updateJournalPanel();
}

function renderJournalDetail() {
  const item = TRIVIA_COLLECTIBLES.find((entry) => entry.id === selectedJournalAnimalId) || TRIVIA_COLLECTIBLES[0];
  const progress = getProgressForItem(item);
  const collected = Boolean(progress.collected);
  const answeredCount = collected ? item.questions.length : (progress.questionIndex || 0);
  journalDetail.replaceChildren();
  journalDetail.style.setProperty('--accent', item.accent);

  const title = document.createElement('h3');
  title.textContent = item.title;

  const meta = document.createElement('p');
  meta.className = 'journal-detail__meta';
  meta.textContent = `${item.rarity} - ${item.trait}`;

  const note = document.createElement('p');
  note.textContent = collected
    ? item.journalNote
    : progress.revealed
      ? `Found, but not finished. Complete ${item.questions.length - answeredCount} more quiz question${item.questions.length - answeredCount === 1 ? '' : 's'} to unlock the full learning log.`
      : 'Not found yet. Use Radar, walk close, and reveal this orb in AR.';

  journalDetail.append(title, meta, note);

  if (!collected) {
    return;
  }

  const learnedTitle = document.createElement('strong');
  learnedTitle.textContent = 'What you learned';

  const learnedList = document.createElement('ul');
  learnedList.className = 'learned-list';

  item.questions.forEach((question) => {
    const entry = document.createElement('li');
    entry.textContent = question.options[question.answer];
    learnedList.appendChild(entry);
  });

  journalDetail.append(learnedTitle, learnedList);
}

function updateProfilePanel() {
  const collectedCount = getCollectedCount();
  const nearest = getNearestCollectible();
  const playerLeaderboardEntry = leaderboard.find((entry) => entry.id === playerProfile.id);

  profileSummary.textContent = collectedCount === TOTAL_COLLECTIBLES
    ? `${playerProfile.name} cleared the route. Keep leveling on the leaderboard.`
    : `${playerProfile.name} is level ${playerProfile.level}. Current challenge: ${playerProfile.difficulty}.`;
  profileProgress.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES}`;
  profileLevel.textContent = playerProfile.level;
  profileXp.textContent = `${playerProfile.xpIntoLevel}/${playerProfile.xpForNextLevel}`;
  profileStreak.textContent = `${playerProfile.streak}x`;
  profileNearest.textContent = nearest ? `${nearest.item.title} ${formatDistance(getCollectibleDistance(nearest))}` : 'Cleared';
  profileRank.textContent = playerLeaderboardEntry ? `#${playerLeaderboardEntry.rank}` : '--';
  profileDifficulty.textContent = playerProfile.difficulty;
  renderLeaderboard();
}

function renderLeaderboard() {
  leaderboardList.replaceChildren();

  if (!leaderboard.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No scores yet.';
    leaderboardList.appendChild(empty);
    return;
  }

  leaderboard.slice(0, 5).forEach((entry) => {
    const item = document.createElement('li');
    item.classList.toggle('is-you', entry.id === playerProfile.id);

    const name = document.createElement('strong');
    name.textContent = `${entry.rank}. ${entry.name}`;

    const score = document.createElement('span');
    score.textContent = `Lv ${entry.level} - ${entry.xp} XP - ${entry.bestStreak}x best`;

    item.append(name, score);
    leaderboardList.appendChild(item);
  });
}

function getCollectedCount() {
  if (!collectibles.length) {
    return TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).filter((item) => getProgressForItem(item).collected).length;
  }

  return collectibles.filter((collectible) => collectible.collected).length;
}

function getProgressForItem(item) {
  const collectible = collectibles.find((entry) => entry.item.id === item.id);

  if (collectible) {
    return {
      collected: collectible.collected,
      questionIndex: collectible.questionIndex,
      revealed: collectible.revealed,
    };
  }

  return savedAnimalProgress[item.id] || {
    collected: false,
    questionIndex: 0,
    revealed: false,
  };
}

function formatDistance(distanceMeters) {
  return `${Math.max(distanceMeters, 0).toFixed(1)}m`;
}

function getDirectionArrow(direction) {
  if (direction === 'Left') {
    return '←';
  }

  if (direction === 'Right') {
    return '→';
  }

  if (direction === 'Behind') {
    return '↓';
  }

  return '↑';
}

function getCollectibleScreenAngleDegrees(collectible) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;

  if (forward.lengthSq() < 0.0001) {
    return 0;
  }

  forward.normalize();
  camera.getWorldPosition(cameraWorldPosition);
  const toCollectible = collectible.group.position.clone().sub(cameraWorldPosition);
  toCollectible.y = 0;

  if (toCollectible.lengthSq() < 0.0001) {
    return 0;
  }

  toCollectible.normalize();
  const right = new THREE.Vector3().crossVectors(forward, upAxis).normalize().negate();
  const angleRadians = Math.atan2(right.dot(toCollectible), forward.dot(toCollectible));
  return THREE.MathUtils.radToDeg(angleRadians);
}

function resetCollectibles() {
  collectibles.forEach((collectible) => scene.remove(collectible.group));
  collectibles = [];
  collectiblesSpawned = false;
  highlightedCollectible = null;
  activeQuiz = null;
  updateCollectionHud();
  updateModePanels();
}

function renderCollectibleList() {
  gameList.replaceChildren();

  TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).forEach((item) => {
    const collectible = collectibles.find((entry) => entry.item.id === item.id);
    const collected = collectible?.collected ?? false;

    const listItem = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = item.title;

    const status = document.createElement('span');
    if (!collectiblesSpawned) {
      status.textContent = 'Waiting to spawn';
    } else if (collected) {
      status.textContent = 'Collected';
    } else {
      const distance = getCollectibleDistance(collectible);
      if (!collectible.revealed && distance > REVEAL_DISTANCE_METERS) {
        status.textContent = `${formatDistance(distance)} - hidden`;
      } else if (distance > INTERACTION_DISTANCE_METERS) {
        status.textContent = `${formatDistance(distance)} - found`;
      } else {
        status.textContent = `${formatDistance(distance)} - tap when centered`;
      }
    }

    listItem.append(title, status);
    gameList.appendChild(listItem);
  });
}

function getNearestCollectible() {
  const activeCollectibles = collectibles.filter((collectible) => !collectible.collected);

  if (!activeCollectibles.length) {
    return null;
  }

  return activeCollectibles.reduce((nearest, collectible) => {
    if (!nearest) {
      return collectible;
    }

    return getCollectibleDistance(collectible) < getCollectibleDistance(nearest) ? collectible : nearest;
  }, null);
}

function getCollectibleDistance(collectible) {
  camera.getWorldPosition(cameraWorldPosition);
  return collectible.group.position.distanceTo(cameraWorldPosition);
}

function getCollectibleDirection(collectible) {
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;

  if (forward.lengthSq() < 0.0001) {
    return 'Ahead';
  }

  forward.normalize();
  camera.getWorldPosition(cameraWorldPosition);
  const toCollectible = collectible.group.position.clone().sub(cameraWorldPosition);
  toCollectible.y = 0;

  if (toCollectible.lengthSq() < 0.0001) {
    return 'Nearby';
  }

  toCollectible.normalize();
  const right = new THREE.Vector3().crossVectors(forward, upAxis).normalize().negate();
  const forwardDot = forward.dot(toCollectible);
  const rightDot = right.dot(toCollectible);

  if (forwardDot > 0.72) {
    return 'Ahead';
  }

  if (forwardDot < -0.25) {
    return 'Behind';
  }

  return rightDot > 0 ? 'Right' : 'Left';
}

function createReticle() {
  const geometry = new THREE.RingGeometry(RETICLE_RADIUS * 0.78, RETICLE_RADIUS, 48);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

function createCollectibleShadow() {
  const geometry = new THREE.CircleGeometry(0.28, 36);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });

  const shadow = new THREE.Mesh(geometry, material);
  shadow.position.y = 0.01;
  return shadow;
}

function showUnsupported(message) {
  startButton.disabled = true;
  startButton.textContent = 'AR not supported';
  statusText.textContent = message;
  unsupportedPanel.classList.remove('hidden');
}

function shuffleArray(items) {
  const clone = [...items];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
