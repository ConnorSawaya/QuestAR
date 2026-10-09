import './style.css';
import { createApiClient } from './api-client.js';
import { generateLocalTopic, isPagesDemoMode } from './local-demo.js';
import { createSpawnSlots, easeAngleDegrees, getQuestionTimeLimitSeconds, horizontalDistance, isLevelGroundPose } from './gameplay-rules.js';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).catch((error) => {
      console.warn('QuestAR could not register offline support:', error.message);
    });
  });
}

const RETICLE_RADIUS = 0.16;
const COLLECTIBLE_HEIGHT = 0.56;
let TOTAL_COLLECTIBLES = 6;
const REVEAL_DISTANCE_METERS = 1.8;
const INTERACTION_DISTANCE_METERS = 1.25;
const DB_NAME = 'quest-ar-progress';
const DB_VERSION = 1;
const PROGRESS_STORE = 'animalProgress';
const PLAYER_ID_KEY = 'quest-ar-player-id';
const PLAYER_NAME_KEY = 'quest-ar-player-name';
const LOCAL_PROFILE_KEY = 'quest-ar-local-profile';
const LOCAL_PROGRESS_KEY = 'quest-ar-local-progress';
const USAGE_STATS_KEY = 'quest-ar-usage-stats';
const PAGES_DEMO_MODE = isPagesDemoMode(import.meta.env.MODE, window.location.hostname);
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const NIM_API_BASE_URL = String(import.meta.env.VITE_NIM_API_BASE_URL || '').replace(/\/+$/, '');
const LOCAL_ONLY_MODE = PAGES_DEMO_MODE || !API_BASE_URL;
const NIM_API_ENABLED = !PAGES_DEMO_MODE && Boolean(NIM_API_BASE_URL);
const TOPIC_API_ENABLED = !PAGES_DEMO_MODE && (NIM_API_ENABLED || !LOCAL_ONLY_MODE);
const LOCAL_ASSISTANT_NAME = PAGES_DEMO_MODE ? 'QuestAR sample' : 'QuestAR';
const { get: apiFetch, post: postApi } = createApiClient({ baseUrl: API_BASE_URL, localOnly: LOCAL_ONLY_MODE });
const { post: postNimApi } = createApiClient({ baseUrl: NIM_API_BASE_URL, localOnly: !NIM_API_ENABLED });

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
const installButton = document.querySelector('#install-app');
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
const topicDifficultySelect = document.querySelector('#topic-difficulty');
const topicStatus = document.querySelector('#topic-status');
const radarSummary = document.querySelector('#radar-summary');
const radarList = document.querySelector('#radar-list');
const mapSummary = document.querySelector('#map-summary');
const areaMapElement = document.querySelector('#area-map');
const journalSummary = document.querySelector('#journal-summary');
const journalList = document.querySelector('#journal-list');
const journalDetail = document.querySelector('#journal-detail');
const profileSummary = document.querySelector('#profile-summary');
const profileProgress = document.querySelector('#profile-progress');
const profileLevel = document.querySelector('#profile-level');
const profileXp = document.querySelector('#profile-xp');
const profileStreak = document.querySelector('#profile-streak');
const profileDifficulty = document.querySelector('#profile-difficulty');
const profileTimeTotal = document.querySelector('#profile-time-total');
const profileTimeToday = document.querySelector('#profile-time-today');
const leaderboardList = document.querySelector('#leaderboard-list');
const regenerateTopic = document.querySelector('#regenerate-topic');
const localDemoButton = document.querySelector('#start-local-demo');
const leaderboardTitle = document.querySelector('#leaderboard-title');
const leaderboardNote = document.querySelector('#leaderboard-note');
const leaderboardCard = document.querySelector('#leaderboard-card');
const questPreview = document.querySelector('#quest-preview');
const previewTitle = document.querySelector('#preview-title');
const previewSummary = document.querySelector('#preview-summary');
const previewStops = document.querySelector('#preview-stops');
const previewQuestions = document.querySelector('#preview-questions');
const previewDifficulty = document.querySelector('#preview-difficulty');
const previewTimeLimit = document.querySelector('#preview-time-limit');
const enableLocationButton = document.querySelector('#enable-location');
const tabBar = document.querySelector('#tab-bar');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
const closestArrow = document.querySelector('#closest-arrow');
const closestArrowIcon = document.querySelector('#closest-arrow-icon');
const closestArrowLabel = document.querySelector('#closest-arrow-label');
const xpToast = document.querySelector('#xp-toast');
const quizPanel = document.querySelector('#quiz-panel');
const quizTitle = document.querySelector('#quiz-title');
const quizStep = document.querySelector('#quiz-step');
const quizTimer = document.querySelector('#quiz-timer');
const quizIntro = document.querySelector('#quiz-intro');
const quizPrompt = document.querySelector('#quiz-prompt');
const quizOptions = document.querySelector('#quiz-options');
const quizFeedback = document.querySelector('#quiz-feedback');
const quizClose = document.querySelector('#quiz-close');
const xrRoot = document.querySelector('#xr-root');

let scene;
let camera;
let renderer;
let THREE;
let threeModulePromise = null;
let leafletModulePromise = null;
let leafletCssPromise = null;
let deferredInstallPrompt = null;
let webglReady = false;
let sceneInitializationPromise = null;
let localDemoActive = false;
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
let selectedTopicDifficulty = topicDifficultySelect.value;
let playerId = getOrCreatePlayerId();
let playerName = getOrCreatePlayerName();
let playerProfile = getDefaultProfile();
let leaderboard = [];
let manualArRetryAvailable = false;
let areaMap = null;
let userCoords = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let locationRequestInFlight = false;
let usageStats = getUsageStats();
let lastUsageTickMs = Date.now();
let activeQuizTimerId = null;
let activeQuizDeadlineMs = 0;
let activeQuestionBonusMultiplier = 1;
let quizResolutionInFlight = false;
let selectionRaycaster;
let selectionOrigin;
let selectionDirection;
let cameraWorldPosition;
let upAxis;
const orbGeometryCache = new Map();
let screenWakeLock = null;
let smoothedClosestAngle = null;
let lastClosestCollectibleId = null;
let lastFloorHitPosition = null;

function readLocalStorage(key) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key, value) {
  try {
    window.localStorage?.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Browser storage is unavailable; this session will remain in memory:', error.message);
    return false;
  }
}

function removeLocalStorage(key) {
  try {
    window.localStorage?.removeItem(key);
  } catch {
    // Storage can be disabled by browser privacy settings.
  }
}

startUsageTracking();
const progressReady = loadProgressState().then(() => {
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

if (LOCAL_ONLY_MODE) {
  localDemoButton.classList.remove('hidden');
  topicStatus.textContent = NIM_API_ENABLED
    ? 'Custom topics try online AI. Built-in packs and progress stay on this device.'
    : 'Built-in question packs work offline and save progress on this device.';
  statusText.textContent = 'Choose a topic to prepare a route. Camera and location are used only when you choose those features.';
  topicMessages.firstElementChild?.replaceChildren(document.createTextNode(
    NIM_API_ENABLED
      ? 'Choose a built-in pack for offline play or ask QuestAR AI to make a custom study hunt when you are online. If AI is unavailable, QuestAR switches to local practice.'
      : 'Choose a built-in topic pack or try a custom topic. Without the question service, custom topics use general study practice.',
  ));
} else {
  leaderboardTitle.textContent = 'Shared leaderboard';
  leaderboardNote.textContent = 'Scores are loaded from the QuestAR server.';
  statusText.textContent = 'Prepare a route first. Camera and location are requested only when needed.';
}

startButton.addEventListener('click', handleStartButtonInteraction);
localDemoButton.addEventListener('click', startLocalDemo);
enableLocationButton?.addEventListener('click', requestMapLocation);
quizClose.addEventListener('click', closeQuizPanel);
topicForm.addEventListener('submit', handleTopicSubmit);
topicDifficultySelect.addEventListener('change', handleTopicDifficultyChange);
regenerateTopic.addEventListener('click', openTopicRegenerator);
document.querySelectorAll('[data-topic]').forEach((button) => {
  button.addEventListener('click', () => {
    topicInput.value = button.dataset.topic || '';
    topicInput.focus();
    topicStatus.textContent = `${topicInput.value} selected. Choose a challenge level, then build your hunt.`;
  });
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.classList.remove('hidden');
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;

  installButton.disabled = true;
  try {
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch (error) {
    console.warn('QuestAR install prompt was unavailable:', error.message);
  } finally {
    deferredInstallPrompt = null;
    installButton.disabled = false;
    installButton.classList.add('hidden');
  }
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.classList.add('hidden');
});
document.addEventListener('visibilitychange', handleVisibilityUsageSync);
window.addEventListener('beforeunload', persistUsageTick);

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
    const saved = JSON.parse(readLocalStorage(LOCAL_PROGRESS_KEY) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      savedAnimalProgress = saved;
    }
  } catch {
    removeLocalStorage(LOCAL_PROGRESS_KEY);
  }

  try {
    const db = await openProgressDb();
    const transaction = db.transaction(PROGRESS_STORE, 'readonly');
    const store = transaction.objectStore(PROGRESS_STORE);
    const records = await requestToPromise(store.getAll());
    savedAnimalProgress = {
      ...savedAnimalProgress,
      ...Object.fromEntries(records.map((record) => [record.id, record])),
    };
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
  writeLocalStorage(LOCAL_PROGRESS_KEY, JSON.stringify(savedAnimalProgress));

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

function getUsageStats() {
  const saved = readLocalStorage(USAGE_STATS_KEY);

  if (saved) {
    try {
      return normalizeUsageStats(JSON.parse(saved));
    } catch {
      removeLocalStorage(USAGE_STATS_KEY);
    }
  }

  return normalizeUsageStats();
}

function normalizeUsageStats(stats = {}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const lastDate = stats.lastDate === todayKey ? stats.lastDate : todayKey;

  return {
    totalSeconds: Math.max(0, Number(stats.totalSeconds) || 0),
    todaySeconds: lastDate === todayKey ? Math.max(0, Number(stats.todaySeconds) || 0) : 0,
    lastDate,
  };
}

function startUsageTracking() {
  updateUsageStats(false);
  window.setInterval(() => {
    updateUsageStats(true);
  }, 15000);
}

function handleVisibilityUsageSync() {
  if (document.visibilityState === 'hidden') {
    persistUsageTick();
    releaseScreenWakeLock();
    return;
  }

  if (currentSession || localDemoActive) void requestScreenWakeLock();
  lastUsageTickMs = Date.now();
  updateUsageStats(false);
}

function persistUsageTick() {
  updateUsageStats(true);
}

function updateUsageStats(shouldPersist) {
  const now = Date.now();
  const todayKey = new Date().toISOString().slice(0, 10);

  if (usageStats.lastDate !== todayKey) {
    usageStats.todaySeconds = 0;
    usageStats.lastDate = todayKey;
  }

  if (document.visibilityState !== 'hidden') {
    const elapsedSeconds = Math.max(0, Math.floor((now - lastUsageTickMs) / 1000));

    if (elapsedSeconds > 0) {
      usageStats.totalSeconds += elapsedSeconds;
      usageStats.todaySeconds += elapsedSeconds;
      shouldPersist = true;
    }
  }

  lastUsageTickMs = now;

  if (shouldPersist) {
    writeLocalStorage(USAGE_STATS_KEY, JSON.stringify(usageStats));
  }

  updateModePanels();
}

function startLocationTracking() {
  if (LOCAL_ONLY_MODE || localDemoActive) {
    mapSummary.textContent = 'Location is off in local quiz mode. Your route and progress stay on this device.';
    return;
  }

  if (!('geolocation' in navigator)) {
    mapSummary.textContent = 'Location is unavailable in this browser. You can keep playing without the map.';
    return;
  }

  if (locationRequestInFlight) return;
  locationRequestInFlight = true;
  enableLocationButton.disabled = true;
  mapSummary.textContent = 'Finding your current location…';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locationRequestInFlight = false;
      enableLocationButton.disabled = false;
      userCoords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      enableLocationButton.textContent = 'Refresh location';
      updateAreaMap();
    },
    (error) => {
      locationRequestInFlight = false;
      enableLocationButton.disabled = false;
      mapSummary.textContent = error.code === error.PERMISSION_DENIED
        ? 'Location was denied. The map can stay blank; your hunt does not need location.'
        : 'Could not get a location fix. Try again or keep playing without the map.';
      updateAreaMap();
    },
    {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 10000,
    },
  );
}

function requestMapLocation() {
  startLocationTracking();
}

function updateStartButtonState() {
  if (currentSession) {
    startButton.classList.remove('hidden');
    startButton.disabled = false;
    startButton.textContent = 'Exit AR';
    return;
  }

  if (manualArRetryAvailable) {
    startButton.classList.remove('hidden');
    startButton.disabled = false;
    startButton.textContent = 'Retry AR';
    return;
  }

  startButton.classList.toggle('hidden', !topicReady || !arSupported || localDemoActive);
  startButton.disabled = generatingTopic || startInteractionInFlight || !webglReady;
  startButton.textContent = webglReady ? 'Begin AR hunt' : 'Preparing AR…';
  localDemoButton.classList.toggle('hidden', !topicReady || localDemoActive);
}

function handleTopicDifficultyChange() {
  selectedTopicDifficulty = topicDifficultySelect.value;
  if (topicReady) {
    topicReady = false;
    questPreview.classList.add('hidden');
    topicStatus.textContent = 'Challenge changed. Prepare the route again to rebuild its questions and timer.';
  }
  updateModePanels();
  updateStartButtonState();
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
  topicReady = false;
  questPreview.classList.add('hidden');
  updateStartButtonState();
  topicGenerate.disabled = true;
  topicStatus.textContent = TOPIC_API_ENABLED ? 'Building your study hunt...' : 'Preparing your study hunt...';
  appendTopicMessage('You', topic);
  appendTopicMessage(LOCAL_ASSISTANT_NAME, 'Preparing your study hunt.');

  try {
    let payload;
    if (!TOPIC_API_ENABLED) {
      payload = generateLocalTopic({ topic, count: 2, difficulty: selectedTopicDifficulty });
    } else {
      try {
        const generateTopic = NIM_API_ENABLED ? postNimApi : postApi;
        payload = await generateTopic('/api/generate-topic', {
          topic,
          count: 6,
          difficulty: selectedTopicDifficulty,
          accuracy: playerProfile.answersTotal ? playerProfile.answersCorrect / playerProfile.answersTotal : 0.7,
        }, { timeoutMs: 45_000 });
      } catch (error) {
        payload = generateLocalTopic({ topic, count: 2, difficulty: selectedTopicDifficulty });
        payload.summary = `${payload.summary} The server could not be reached, so this route uses local practice questions.`;
        console.warn('QuestAR switched to local questions:', error.message);
      }
    }
    applyGeneratedTopic(payload, resetExisting);
    topicStatus.textContent = `${payload.orbs.length} ${payload.topic} stops are ready. Review the route before starting.`;
    appendTopicMessage(LOCAL_ASSISTANT_NAME, payload.summary || `Prepared ${payload.orbs.length} stops.`);
  } catch (error) {
    topicStatus.textContent = 'Could not generate topic right now. Try again.';
    appendTopicMessage(LOCAL_ASSISTANT_NAME, `Could not build the hunt: ${error.message}`);
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
  topicMessages.replaceChildren(entry);
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
  selectedTopicDifficulty = payload.difficulty || selectedTopicDifficulty;
  topicDifficultySelect.value = selectedTopicDifficulty;
  topicReady = true;
  previewTitle.textContent = currentTopicPrompt;
  previewSummary.textContent = currentTopicSummary;
  previewStops.textContent = TOTAL_COLLECTIBLES;
  previewQuestions.textContent = TRIVIA_COLLECTIBLES.reduce((total, item) => total + item.questions.length, 0);
  previewDifficulty.textContent = selectedTopicDifficulty;
  if (previewTimeLimit) previewTimeLimit.textContent = `${getQuestionTimeLimitSeconds(selectedTopicDifficulty)} sec per question`;
  questPreview.classList.remove('hidden');

  if (resetExisting && collectiblesSpawned) {
    resetCollectibles();
  }

  updateCollectionHud();
  updateModePanels();
}

function normalizeGeneratedOrbForClient(orb) {
  if (!orb?.id || !String(orb?.title || '').trim() || !Array.isArray(orb.questions) || orb.questions.length < 3) {
    return null;
  }

  const questions = orb.questions.slice(0, 3).map((question) => {
    const prompt = String(question?.prompt || '').trim();
    const options = Array.isArray(question?.options) ? question.options.map((option) => String(option || '').trim()) : [];
    const answer = question?.answer;
    if (!prompt || options.length !== 3 || options.some((option) => !option) || !Number.isInteger(answer) || answer < 0 || answer > 2) return null;
    return { prompt, options, answer };
  });
  if (questions.some((question) => !question)) return null;

  return {
    ...orb,
    id: String(orb.id).slice(0, 80),
    title: String(orb.title).trim().slice(0, 42),
    questions,
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

  if (localDemoActive) {
    localDemoActive = false;
    document.body.classList.remove('is-local-demo-active');
    gamePanel.classList.add('hidden');
    gamePanel.classList.remove('is-expanded');
    tabBar.classList.add('hidden');
    releaseScreenWakeLock();
  }

  topicInput.focus();
  topicReady = false;
  questPreview.classList.add('hidden');
  topicStatus.textContent = `Enter a new topic to prepare another ${selectedTopicDifficulty.toLowerCase()} route.`;
  updateStartButtonState();
}

function getOrCreatePlayerId() {
  const existing = readLocalStorage(PLAYER_ID_KEY);

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeLocalStorage(PLAYER_ID_KEY, id);
  return id;
}

function getOrCreatePlayerName() {
  const existing = readLocalStorage(PLAYER_NAME_KEY);

  if (existing) {
    return existing;
  }

  const name = `Explorer ${playerId.slice(-4).toUpperCase()}`;
  writeLocalStorage(PLAYER_NAME_KEY, name);
  return name;
}

function getDefaultProfile() {
  const saved = readLocalStorage(LOCAL_PROFILE_KEY);

  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      removeLocalStorage(LOCAL_PROFILE_KEY);
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
  if (LOCAL_ONLY_MODE) {
    updateModePanels();
    return;
  }

  try {
    const payload = await apiFetch(`/api/profile?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}`);
    applyProfilePayload(payload);
  } catch (error) {
    console.warn('Profile API unavailable, using local profile:', error.message);
    updateModePanels();
  }
}

async function recordAnswerEvent(correct, collectible, questionIndex, bonusMultiplier = 1) {
  const payload = LOCAL_ONLY_MODE
    ? applyLocalAnswerEvent(correct, questionIndex, bonusMultiplier)
    : await postApi('/api/answer', {
        playerId,
        name: playerName,
        animalId: collectible.item.id,
        questionIndex,
        correct,
        bonusMultiplier,
      }).catch(() => applyLocalAnswerEvent(correct, questionIndex, bonusMultiplier));

  applyProfilePayload(payload);
  showXpToast(payload.xpGained || 0, payload.leveledUp, payload.profile?.level);
  return payload;
}

async function recordCollectionEvent(collectible) {
  const payload = LOCAL_ONLY_MODE
    ? applyLocalCollectionEvent(collectible.item.id)
    : await postApi('/api/collect', {
        playerId,
        name: playerName,
        animalId: collectible.item.id,
      }).catch(() => applyLocalCollectionEvent(collectible.item.id));

  applyProfilePayload(payload);
  showXpToast(payload.xpGained || 0, payload.leveledUp, payload.profile?.level);
  return payload;
}

function applyProfilePayload(payload) {
  if (payload?.profile) {
    playerProfile = decorateClientProfile(payload.profile);
    writeLocalStorage(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
  }

  if (payload?.leaderboard) {
    leaderboard = payload.leaderboard;
  }

  updateModePanels();
}

function createLocalDemoCollectible(item) {
  const progress = savedAnimalProgress[item.id] || {};
  return {
    item,
    collected: Boolean(progress.collected),
    questionIndex: Math.min(Number(progress.questionIndex) || 0, item.questions.length),
    revealed: true,
    group: { visible: !progress.collected },
  };
}

async function startLocalDemo() {
  await progressReady;

  if (currentSession) {
    await currentSession.end();
  }

  if (!topicReady) {
    const topic = topicInput.value.trim() || currentTopicPrompt;
    applyGeneratedTopic(generateLocalTopic({ topic, count: 2, difficulty: selectedTopicDifficulty }), true);
  }

  localDemoActive = true;
  void requestScreenWakeLock();
  document.body.classList.add('is-local-demo-active');
  unsupportedPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gamePanel.classList.add('is-expanded');
  tabBar.classList.remove('hidden');
  resetCollectibles();
  collectibles = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).map(createLocalDemoCollectible);
  collectiblesSpawned = true;
  setActiveMode('hunt');
  updateCollectionHud();
  updateModePanels();
  topicStatus.textContent = 'Quiz route active. Choose a stop to answer its questions. Progress saves on this device.';
  statusText.textContent = 'Playing without AR. No camera or location is used.';
}

function applyLocalAnswerEvent(correct, questionIndex, bonusMultiplier = 1) {
  const previousLevel = playerProfile.level;
  let xpGained = 0;
  const nextProfile = { ...playerProfile };
  nextProfile.answersTotal += 1;

  if (correct) {
    nextProfile.answersCorrect += 1;
    nextProfile.streak += 1;
    nextProfile.bestStreak = Math.max(nextProfile.bestStreak, nextProfile.streak);
    xpGained = getClientAnswerXp(nextProfile.level, nextProfile.streak, questionIndex, bonusMultiplier);
    nextProfile.xp += xpGained;
  } else {
    nextProfile.streak = 0;
  }

  playerProfile = decorateClientProfile(nextProfile);
  writeLocalStorage(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
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
  writeLocalStorage(LOCAL_PROFILE_KEY, JSON.stringify(playerProfile));
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

function getClientAnswerXp(level, streak, questionIndex, bonusMultiplier = 1) {
  const baseXp = 22 + Math.min(level * 2, 24) + Math.min(streak * 4, 40) + Math.max(questionIndex, 0) * 3;
  return Math.round(baseXp * Math.min(Math.max(bonusMultiplier, 1), 2));
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
  if (startButton.disabled || startInteractionInFlight) {
    return;
  }

  if (!currentSession && (!topicReady || !arSupported || !webglReady)) {
    return;
  }

  startInteractionInFlight = true;
  statusText.textContent = currentSession ? 'Closing AR session…' : 'Opening the AR camera…';
  void startARSession().finally(() => {
    startInteractionInFlight = false;
    updateStartButtonState();
  });
}

function initScene() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
  return true;
}

async function ensureThree({ initializeScene = false } = {}) {
  if (!threeModulePromise) {
    threeModulePromise = import('three').then((module) => {
      THREE = module;
      selectionRaycaster = new THREE.Raycaster();
      selectionOrigin = new THREE.Vector3();
      selectionDirection = new THREE.Vector3();
      cameraWorldPosition = new THREE.Vector3();
      upAxis = new THREE.Vector3(0, 1, 0);
      lastFloorHitPosition = new THREE.Vector3();
    }).catch((error) => {
      threeModulePromise = null;
      throw error;
    });
  }

  await threeModulePromise;
  if (!initializeScene || webglReady) return true;

  if (!sceneInitializationPromise) {
    sceneInitializationPromise = Promise.resolve().then(initScene).then((ready) => {
      webglReady = ready;
      return ready;
    }).catch((error) => {
      sceneInitializationPromise = null;
      throw error;
    });
  }

  return sceneInitializationPromise;
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
    statusText.textContent = 'AR is supported. Your camera opens only after you press Begin AR hunt.';
    updateStartButtonState();
    void ensureThree({ initializeScene: true }).then(() => updateStartButtonState()).catch((error) => {
      console.warn('WebGL could not start:', error.message);
      arSupported = false;
      showUnsupported('This device could not start 3D AR graphics. Play the prepared route in local quiz mode.');
      updateStartButtonState();
    });
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
    if (!webglReady || !renderer) {
      throw new Error('AR graphics are still preparing. Try again in a moment or play the quiz route.');
    }
    manualArRetryAvailable = false;
    startButton.disabled = true;
    startButton.classList.remove('hidden');
    startButton.textContent = 'Starting...';
    statusText.textContent = 'Requesting camera access for this AR session…';
    renderer.xr.setReferenceSpaceType('local');
    void requestScreenWakeLock();

    const session = await requestARSession();
    currentSession = session;
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
    topicStatus.textContent = 'AR active. Scan the floor to place your route.';
    statusText.textContent = 'Move your phone slowly to find level ground. Keep the area around you clear.';
  } catch (error) {
    const failedSession = currentSession;
    currentSession = null;
    failedSession?.removeEventListener('end', endARSession);
    if (failedSession) await failedSession.end().catch(() => {});
    renderer?.setAnimationLoop(null);
    hitTestSource = null;
    hitTestSourceRequested = false;
    stableFloorFrames = 0;
    document.body.classList.remove('is-ar-active');
    releaseScreenWakeLock();
    manualArRetryAvailable = true;
    updateStartButtonState();
    topicStatus.textContent = 'AR could not open. Review the message and retry, or use quiz mode.';
    statusText.textContent = `AR could not start: ${error.message}`;
  }
}

async function requestScreenWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    screenWakeLock = await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release', () => { screenWakeLock = null; }, { once: true });
  } catch (error) {
    console.info('Screen wake lock is unavailable:', error.message);
  }
}

function releaseScreenWakeLock() {
  if (!screenWakeLock) return;
  void screenWakeLock.release().catch(() => {});
  screenWakeLock = null;
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
  hitTestSource = null;
  hitTestSourceRequested = false;
  stableFloorFrames = 0;
  lastFloorHitPosition?.set(0, 0, 0);
  if (reticle) reticle.visible = false;
  stopQuizTimer();
  resetCollectibles();
  closeQuizPanel();
  gamePanel.classList.add('hidden');
  gamePanel.classList.remove('is-expanded');
  tabBar.classList.add('hidden');
  renderer?.setAnimationLoop(null);
  releaseScreenWakeLock();
  manualArRetryAvailable = false;
  smoothedClosestAngle = null;
  lastClosestCollectibleId = null;
  document.body.classList.remove('is-ar-active');
  updateStartButtonState();
  statusText.textContent = 'AR ended. Your answered questions are saved; begin again to place a new route.';
}

function render(timestamp, frame) {
  if (!renderer || !webglReady) {
    return;
  }

  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace, entityTypes: ['plane'] }).then((source) => {
          hitTestSource = source;
        }).catch((error) => {
          hitTestSourceRequested = false;
          statusText.textContent = `Surface scanning is unavailable: ${error.message}`;
        });
      }).catch((error) => {
        hitTestSourceRequested = false;
        statusText.textContent = `Could not prepare surface scanning: ${error.message}`;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource && !collectiblesSpawned) {
      const hitResults = frame.getHitTestResults(hitTestSource);
      camera.getWorldPosition(cameraWorldPosition);
      let pose = null;
      for (const hit of hitResults) {
        const candidate = hit.getPose(referenceSpace);
        if (candidate && isLevelGroundPose(candidate.transform.matrix, cameraWorldPosition.y)) {
          pose = candidate;
          break;
        }
      }

      if (pose) {
        const matrix = pose.transform.matrix;
        const floorDeltaX = matrix[12] - lastFloorHitPosition.x;
        const floorDeltaY = matrix[13] - lastFloorHitPosition.y;
        const floorDeltaZ = matrix[14] - lastFloorHitPosition.z;
        if (stableFloorFrames > 0 && floorDeltaX ** 2 + floorDeltaY ** 2 + floorDeltaZ ** 2 > 0.0144) {
          stableFloorFrames = 0;
        }
        lastFloorHitPosition.set(matrix[12], matrix[13], matrix[14]);
        reticle.visible = true;
        reticle.matrix.fromArray(matrix);
        stableFloorFrames += 1;

        if (stableFloorFrames < 8) {
          statusText.textContent = 'Level ground found. Hold steady to place the first stop.';
        } else {
          spawnCollectiblesFromReticle();
        }
      } else {
        reticle.visible = false;
        stableFloorFrames = 0;
        statusText.textContent = hitResults.length
          ? 'Looking for level ground below the phone. Tilt toward a clear patch of floor.'
          : 'Scanning for level ground. Move your phone slowly toward a clear area.';
      }
    }
  }

  updateCollectibles(performance.now() * 0.001);

  if (timestamp - lastHudRefreshMs > 220) {
    updateClosestArrow();
    if (activeMode === 'radar') updateRadarPanel();
    lastHudRefreshMs = timestamp;
  }

  renderer.render(scene, camera);
}

function handleARSelect() {
  if (activeQuiz) {
    return;
  }

  if (!collectiblesSpawned) {
    statusText.textContent = stableFloorFrames > 0 ? 'Hold steady. The nearby route is being placed.' : 'Move your phone slowly until level ground is found.';
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
    gameHint.textContent = `Keep ${collectible.item.title} centered and move closer. You must be within ${formatDistance(INTERACTION_DISTANCE_METERS)} to start the quiz.`;
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
  const spawnSlots = createSpawnSlots(TOTAL_COLLECTIBLES);

  collectibles = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).map((item, index) => {
    const slot = spawnSlots[index];
    const offset = heading.clone().multiplyScalar(Math.cos(slot.angle) * slot.distance).add(right.clone().multiplyScalar(Math.sin(slot.angle) * slot.distance));
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
  statusText.textContent = `${TOTAL_COLLECTIBLES} stops placed within a few steps. Keep your surroundings clear as you move.`;
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
    getSharedOrbGeometry('ground-ring', () => new THREE.TorusGeometry(0.32, 0.018, 8, 28)),
    new THREE.MeshBasicMaterial({ color: item.accent, transparent: true, opacity: 0.78 }),
  );
  groundRing.rotation.x = Math.PI / 2;
  groundRing.position.y = 0.015;
  group.add(groundRing);

  const beacon = new THREE.Mesh(
    getSharedOrbGeometry('beacon', () => new THREE.CylinderGeometry(0.045, 0.11, 1.35, 10, 1, true)),
    new THREE.MeshBasicMaterial({
      color: item.accent,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beacon.position.y = 0.68;
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
  const halo = new THREE.Mesh(getSharedOrbGeometry('orb-band', () => new THREE.TorusGeometry(0.28, 0.012, 6, 24)), haloMaterial);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.27;
  floatRig.add(halo);

  const cardTexture = createCollectibleTexture(item);
  const cardMaterial = new THREE.MeshBasicMaterial({ map: cardTexture, transparent: true, side: THREE.DoubleSide });
  const card = new THREE.Mesh(getSharedOrbGeometry('field-tag', () => new THREE.PlaneGeometry(0.58, 0.3)), cardMaterial);
  card.position.y = 0.72;
  floatRig.add(card);

  const hitArea = new THREE.Mesh(
    getSharedOrbGeometry('hit-area', () => new THREE.PlaneGeometry(1.25, 1.35)),
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
    ownedTextures: [cardTexture],
    questionIndex: Math.min(progress.questionIndex || 0, item.questions.length),
    revealed: Boolean(progress.revealed || progress.collected),
    worldBaseY: COLLECTIBLE_HEIGHT,
    bobOffset: Math.random() * Math.PI * 2,
  };
}

function createTopicOrbModel(item) {
  const group = new THREE.Group();
  const color = new THREE.Color(item.accent || '#79974b');
  const shellMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.025,
    roughness: 0.42,
    metalness: 0.04,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({
    color: '#f4f1df',
    roughness: 0.55,
    metalness: 0,
  });
  const bandMaterial = new THREE.MeshBasicMaterial({ color: '#19392f' });
  const shell = new THREE.Mesh(getSharedOrbGeometry('orb-shell', () => new THREE.SphereGeometry(0.22, 16, 12)), shellMaterial);
  const core = new THREE.Mesh(getSharedOrbGeometry('orb-core', () => new THREE.SphereGeometry(0.1, 12, 8)), coreMaterial);
  const band = new THREE.Mesh(getSharedOrbGeometry('orb-band-shape', () => new THREE.TorusGeometry(0.255, 0.012, 6, 24)), bandMaterial);
  band.rotation.set(Math.PI / 2.7, 0.2, 0.2);
  group.add(shell, core, band);
  group.userData = { highlightMaterial: shellMaterial };

  return group;
}

function getSharedOrbGeometry(key, createGeometry) {
  if (!orbGeometryCache.has(key)) orbGeometryCache.set(key, createGeometry());
  return orbGeometryCache.get(key);
}

function createCollectibleTexture(item) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  context.fillStyle = '#f4f1df';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = item.accent;
  context.lineWidth = 5;
  context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  context.textAlign = 'left';
  context.textBaseline = 'middle';

  context.fillStyle = '#19392f';
  context.font = '700 24px sans-serif';
  context.fillText(item.title.slice(0, 22), 18, 48);

  context.fillStyle = '#4e5f52';
  context.font = '500 15px sans-serif';
  context.fillText('FIELD STOP · 3 QUESTIONS', 18, 105);

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

    const bob = Math.sin(timeSeconds * 1.2 + collectible.bobOffset) * 0.035;
    collectible.floatRig.position.y = collectible.worldBaseY + bob;
    collectible.orbModel.rotation.y += 0.003;
    collectible.halo.rotation.z += 0.004;
    collectible.card.lookAt(cameraWorldPosition);
    collectible.hitArea.lookAt(cameraWorldPosition);

    const isHighlighted = collectible === highlightedCollectible;
    collectible.floatRig.scale.setScalar(isHighlighted ? 1.08 : 1);
    collectible.orbModel.userData.highlightMaterial.emissiveIntensity = isHighlighted ? 0.12 : 0.025;
    collectible.halo.material.opacity = isHighlighted ? 0.82 : 0.56;
    collectible.beacon.material.opacity = isHighlighted ? 0.2 : 0.12;
    collectible.groundRing.material.opacity = isHighlighted ? 0.92 : 0.7;
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
  quizResolutionInFlight = false;
  quizFeedback.textContent = '';
  renderQuizQuestion();
  quizPanel.classList.remove('hidden');
  gameHint.textContent = `You found ${collectible.item.title}. Answer all 3 questions to collect it.`;
  statusText.textContent = `${collectible.item.title} is ready for you.`;
}

function renderQuizQuestion() {
  const collectible = activeQuiz;

  if (!collectible) {
    return;
  }

  const question = collectible.item.questions[collectible.questionIndex];
  quizResolutionInFlight = false;
  activeQuestionBonusMultiplier = 1;

  quizTitle.textContent = `You found ${collectible.item.title}`;
  quizStep.textContent = `Question ${collectible.questionIndex + 1} of ${collectible.item.questions.length}`;
  quizIntro.textContent = 'Answer all three questions to add this stop to your journal.';
  quizPrompt.textContent = question.prompt;
  quizOptions.replaceChildren();
  startQuizTimer();

  question.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.dataset.optionLetter = String.fromCharCode(65 + index);
    button.textContent = option;
    button.addEventListener('click', () => handleQuizAnswer(index));
    quizOptions.appendChild(button);
  });
}

async function handleQuizAnswer(answerIndex) {
  const collectible = activeQuiz;

  if (!collectible || quizResolutionInFlight) {
    return;
  }

  quizResolutionInFlight = true;
  stopQuizTimer();
  const question = collectible.item.questions[collectible.questionIndex];
  const questionIndex = collectible.questionIndex;

  if (answerIndex !== question.answer) {
    quizFeedback.textContent = 'Not quite. Take another shot, you are still in it.';
    await recordAnswerEvent(false, collectible, questionIndex, 1);
    renderQuizQuestion();
    return;
  }

  activeQuestionBonusMultiplier = getQuestionBonusMultiplier();
  await recordAnswerEvent(true, collectible, questionIndex, activeQuestionBonusMultiplier);
  collectible.questionIndex += 1;
  void saveAnimalProgress(collectible);

  if (collectible.questionIndex >= collectible.item.questions.length) {
    collectCollectible(collectible);
    return;
  }

  const bonusLabel = activeQuestionBonusMultiplier > 1 ? ` x${activeQuestionBonusMultiplier.toFixed(2)} bonus` : '';
  quizFeedback.textContent = `Correct.${bonusLabel} ${collectible.item.questions.length - collectible.questionIndex} more to go.`;
  renderQuizQuestion();
}

function startQuizTimer() {
  stopQuizTimer();
  activeQuizDeadlineMs = Date.now() + getQuestionTimeLimitSeconds(selectedTopicDifficulty) * 1000;
  updateQuizTimerDisplay();
  activeQuizTimerId = window.setInterval(updateQuizTimerDisplay, 250);
}

function stopQuizTimer() {
  if (activeQuizTimerId !== null) {
    window.clearInterval(activeQuizTimerId);
    activeQuizTimerId = null;
  }
}

function updateQuizTimerDisplay() {
  if (!activeQuiz) {
    stopQuizTimer();
    quizTimer.textContent = `${getQuestionTimeLimitSeconds(selectedTopicDifficulty)}s`;
    quizTimer.classList.remove('is-urgent');
    return;
  }

  const remainingMs = Math.max(0, activeQuizDeadlineMs - Date.now());
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  quizTimer.textContent = `${remainingSeconds}s`;
  quizTimer.classList.toggle('is-urgent', remainingSeconds <= 5);

  if (remainingMs <= 0 && !quizResolutionInFlight) {
    void handleQuizTimeout();
  }
}

function getQuestionBonusMultiplier() {
  const remainingMs = Math.max(0, activeQuizDeadlineMs - Date.now());
  const remainingRatio = Math.min(Math.max(remainingMs / (getQuestionTimeLimitSeconds(selectedTopicDifficulty) * 1000), 0), 1);
  return 1 + remainingRatio * 0.6;
}

async function handleQuizTimeout() {
  if (!activeQuiz || quizResolutionInFlight) {
    return;
  }

  quizResolutionInFlight = true;
  stopQuizTimer();
  const collectible = activeQuiz;
  const questionIndex = collectible.questionIndex;
  quizFeedback.textContent = 'Time is up. The question reset, so take another shot.';
  await recordAnswerEvent(false, collectible, questionIndex, 1);
  renderQuizQuestion();
}

function collectCollectible(collectible) {
  collectible.collected = true;
  collectible.group.visible = false;
  activeQuiz = null;
  stopQuizTimer();
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
    const generateTopic = NIM_API_ENABLED ? postNimApi : postApi;
    const payload = !TOPIC_API_ENABLED
      ? generateLocalTopic({ topic: currentTopicPrompt, count: 2, difficulty: selectedTopicDifficulty, wave: orbWaveIndex })
      : await generateTopic('/api/generate-topic', {
          topic: currentTopicPrompt,
          count: 6,
          difficulty: selectedTopicDifficulty,
          accuracy: playerProfile.answersTotal ? playerProfile.answersCorrect / playerProfile.answersTotal : 0.7,
        }, { timeoutMs: 45_000 });
    applyGeneratedTopic(withWaveOrbIds(payload, orbWaveIndex), false);
  } catch (error) {
    console.warn('Could not generate next wave:', error.message);
    const fallback = generateLocalTopic({
      topic: currentTopicPrompt,
      count: 2,
      difficulty: selectedTopicDifficulty,
      wave: orbWaveIndex,
    });
    applyGeneratedTopic(withWaveOrbIds(fallback, orbWaveIndex), false);
  }

  resetCollectibles();
  if (localDemoActive) {
    collectibles = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).map(createLocalDemoCollectible);
    collectiblesSpawned = true;
    updateCollectionHud();
    updateModePanels();
    gameHint.textContent = 'New local wave ready. Pick an orb from the list to keep playing.';
  } else {
    spawnCollectiblesNearPlayer(lastFloorY);
  }
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
  stopQuizTimer();
  activeQuiz = null;
  quizResolutionInFlight = false;
  quizPanel.classList.add('hidden');
  quizFeedback.textContent = '';
  quizTimer.textContent = `${getQuestionTimeLimitSeconds(selectedTopicDifficulty)}s`;
  quizTimer.classList.remove('is-urgent');

  if (collectiblesSpawned && getCollectedCount() < TOTAL_COLLECTIBLES) {
    gameHint.textContent = `Use Radar distance. Orbs reveal inside ${formatDistance(REVEAL_DISTANCE_METERS)}; get within ${formatDistance(INTERACTION_DISTANCE_METERS)}, center, and tap.`;
  }
}

function updateCollectionHud() {
  const collectedCount = getCollectedCount();
  gameCount.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES} collected`;
  renderCollectibleList();

  if (localDemoActive) {
    gameHint.textContent = collectedCount === TOTAL_COLLECTIBLES
      ? 'Quest complete. A fresh local question wave is ready.'
      : 'Choose any orb card to start its quiz. Correct answers earn XP and save on this device.';
    return;
  }

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
  gamePanel.dataset.mode = mode;

  document.querySelectorAll('.mode-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== `mode-${mode}`);
  });

  tabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
    if (button.dataset.mode === mode) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  if (mode === 'map') {
    updateAreaMap();
  }
  if (mode === 'radar') updateRadarPanel();
}

function updateModePanels() {
  if (activeMode === 'radar') updateRadarPanel();
  updateJournalPanel();
  updateProfilePanel();
  if (!currentSession) updateClosestArrow();
}

function updateClosestArrow() {
  if (localDemoActive || !collectiblesSpawned || activeQuiz) {
    closestArrow.classList.add('hidden');
    return;
  }

  const nearest = getNearestCollectible();

  if (!nearest) {
    closestArrow.classList.add('hidden');
    return;
  }

  if (lastClosestCollectibleId !== nearest.item.id) {
    lastClosestCollectibleId = nearest.item.id;
    smoothedClosestAngle = getCollectibleScreenAngleDegrees(nearest);
  }
  const angle = getCollectibleScreenAngleDegrees(nearest);
  smoothedClosestAngle = easeAngleDegrees(smoothedClosestAngle ?? angle, angle, 0.42);
  const direction = getCollectibleDirection(nearest);
  closestArrowIcon.style.transform = `rotate(${smoothedClosestAngle}deg)`;
  closestArrowLabel.textContent = `${getGuidanceText(direction, angle)} · ${formatDistance(getCollectibleDistance(nearest))}`;
  closestArrow.classList.remove('hidden');
}

function updateRadarPanel() {
  if (localDemoActive) {
    const remaining = collectibles.filter((collectible) => !collectible.collected).length;
    radarSummary.textContent = remaining
      ? `${remaining} quiz stops are ready. Choose one from the Hunt tab.`
      : 'Route complete. Preparing the next local practice round.';
    radarList.replaceChildren();
    const prompt = document.createElement('strong');
    prompt.textContent = 'No direction tracking in local mode';
    radarList.appendChild(prompt);
    return;
  }

  if (!collectiblesSpawned) {
    radarSummary.textContent = 'Waiting for the floor lock so the radar can pick up signals.';
    radarList.replaceChildren();
    return;
  }

  const nearest = getNearestCollectible();
  const direction = nearest ? getCollectibleDirection(nearest) : null;
  const angle = nearest ? getCollectibleScreenAngleDegrees(nearest) : 0;
  radarSummary.textContent = nearest
    ? `${nearest.item.title}: ${getGuidanceText(direction, angle)}. Visible near ${formatDistance(REVEAL_DISTANCE_METERS)}, tappable near ${formatDistance(INTERACTION_DISTANCE_METERS)}.`
    : 'All signals collected.';

  radarList.replaceChildren();

  if (!nearest) {
    const cleared = document.createElement('strong');
    cleared.textContent = 'Route cleared';
    radarList.appendChild(cleared);
    return;
  }

  const distance = getCollectibleDistance(nearest);
  const arrowWrap = document.createElement('div');
  arrowWrap.className = 'radar-compass__bubble';

  const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrow.className = 'radar-compass__arrow';
  arrow.setAttribute('viewBox', '0 0 24 24');
  arrow.setAttribute('aria-hidden', 'true');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arrowPath.setAttribute('d', 'm12 3 7.5 8h-5v10h-5V11h-5L12 3Z');
  arrow.appendChild(arrowPath);
  arrow.style.transform = `rotate(${angle}deg)`;

  const distanceLabel = document.createElement('strong');
  distanceLabel.textContent = `${formatDistance(distance)} away`;

  const targetLabel = document.createElement('span');
  targetLabel.textContent = `${nearest.item.title} · ${getGuidanceText(direction, angle)}`;

  arrowWrap.appendChild(arrow);
  radarList.append(arrowWrap, distanceLabel, targetLabel);
}

async function loadLeaflet() {
  if (!leafletModulePromise) {
    leafletCssPromise ||= import('leaflet/dist/leaflet.css');
    leafletModulePromise = import('leaflet').then(({ default: module }) => module).catch((error) => {
      leafletModulePromise = null;
      throw error;
    });
  }
  await leafletCssPromise;
  return leafletModulePromise;
}

async function updateAreaMap() {
  if (!areaMapElement) {
    return;
  }

  if (LOCAL_ONLY_MODE || localDemoActive) {
    enableLocationButton?.classList.add('hidden');
    mapSummary.textContent = 'Location is off in local quiz mode. Your hunt works without it.';
    return;
  }

  if (activeMode !== 'map') {
    return;
  }

  if (!userCoords) {
    enableLocationButton?.classList.remove('hidden');
    mapSummary.textContent = 'Location is optional. Show your current position here; QuestAR never uses it to place AR stops.';
    return;
  }

  let leaflet;
  try {
    leaflet = await loadLeaflet();
  } catch (error) {
    mapSummary.textContent = 'The street map could not load. Your AR route does not depend on it.';
    console.warn('QuestAR map could not load:', error.message);
    return;
  }

  if (activeMode !== 'map') return;
  enableLocationButton?.classList.remove('hidden');

  if (!areaMap) {
    areaMap = leaflet.map(areaMapElement, { zoomControl: true, attributionControl: true });
    leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(areaMap);
    areaMap.whenReady(() => window.requestAnimationFrame(() => areaMap?.invalidateSize()));
  }

  const center = [userCoords.latitude, userCoords.longitude];
  if (!userLocationMarker) {
    userLocationMarker = leaflet.circleMarker(center, {
      radius: 8,
      color: '#19392f',
      weight: 2,
      fillColor: '#79974b',
      fillOpacity: 1,
    }).addTo(areaMap);
  } else {
    userLocationMarker.setLatLng(center);
  }

  if (!userAccuracyCircle) {
    userAccuracyCircle = leaflet.circle(center, {
      radius: Math.max(0, userCoords.accuracy || 0),
      color: '#244b3e',
      weight: 1,
      fillColor: '#79974b',
      fillOpacity: 0.12,
    }).addTo(areaMap);
  } else {
    userAccuracyCircle.setLatLng(center);
    userAccuracyCircle.setRadius(Math.max(0, userCoords.accuracy || 0));
  }

  if ((userCoords.accuracy || 0) > 0) {
    areaMap.fitBounds(userAccuracyCircle.getBounds().pad(0.25), { animate: false });
  } else {
    areaMap.setView(center, 17, { animate: false });
  }
  const accuracyText = userCoords.accuracy ? `Location estimate ±${Math.round(userCoords.accuracy)} m.` : 'Location estimate received.';
  mapSummary.textContent = `${accuracyText} AR stops are anchored separately and do not appear on this street map.`;
}

function updateJournalPanel() {
  const lifetimeCollectedCount = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).filter((item) => getProgressForItem(item).collected).length;
  journalSummary.textContent = lifetimeCollectedCount
    ? `Orb Dex ${Math.round((lifetimeCollectedCount / TOTAL_COLLECTIBLES) * 100)}% filled. ${lifetimeCollectedCount} of ${TOTAL_COLLECTIBLES} orbs captured.`
    : 'Tap an orb slot to inspect it. Seen and captured orbs show up here.';

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
      state.textContent = 'Captured';
    } else if (answeredCount > 0) {
      state.textContent = `Quiz ${answeredCount}/${item.questions.length}`;
    } else if (progress.revealed) {
      state.textContent = 'Seen';
    } else {
      state.textContent = 'Hidden';
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
  const categoryLabel = formatCategoryLabel(item.category);
  journalDetail.replaceChildren();
  journalDetail.style.setProperty('--accent', item.accent);

  const title = document.createElement('h3');
  title.textContent = item.title;

  const meta = document.createElement('p');
  meta.className = 'journal-detail__meta';
  meta.textContent = `${categoryLabel} orb · ${item.trait}`;

  const note = document.createElement('p');
  note.textContent = collected
    ? item.journalNote
    : progress.revealed
      ? `${localDemoActive ? 'Available in the local demo' : 'Seen in AR'}, but not captured yet. Complete ${item.questions.length - answeredCount} more quiz question${item.questions.length - answeredCount === 1 ? '' : 's'} to finish this orb.`
      : localDemoActive
        ? 'Not started yet. Choose this orb from the Hunt tab to begin its quiz.'
        : 'Not seen yet. Use Radar, walk closer, and reveal this orb in AR.';

  journalDetail.append(title, meta, note);

  if (!collected) {
    return;
  }

  const learnedTitle = document.createElement('strong');
  learnedTitle.textContent = 'Unlocked facts';

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
  const displayLeaderboard = getDisplayLeaderboard();

  profileSummary.textContent = LOCAL_ONLY_MODE
    ? `Your progress stays on this device. Local questions and scores are private to this browser.`
    : collectedCount === TOTAL_COLLECTIBLES
      ? `Route complete. Your answers and collections are saved to your QuestAR profile.`
      : `Your answers and collections are saved as you play. Current challenge: ${selectedTopicDifficulty}.`;
  profileProgress.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES}`;
  profileLevel.textContent = playerProfile.level;
  profileXp.textContent = `${playerProfile.xpIntoLevel}/${playerProfile.xpForNextLevel}`;
  profileStreak.textContent = `${playerProfile.streak}x`;
  if (profileDifficulty) profileDifficulty.textContent = selectedTopicDifficulty;
  profileTimeTotal.textContent = formatUsageDuration(usageStats.totalSeconds);
  profileTimeToday.textContent = formatUsageDuration(usageStats.todaySeconds);
  renderLeaderboard(displayLeaderboard);
}

function renderLeaderboard(displayLeaderboard) {
  leaderboardList.replaceChildren();
  leaderboardCard.classList.toggle('hidden', displayLeaderboard.length === 0);

  const visibleEntries = activeMode === 'you' ? displayLeaderboard : displayLeaderboard.slice(0, 6);

  visibleEntries.forEach((entry) => {
    const item = document.createElement('li');
    item.classList.toggle('is-you', entry.id === playerProfile.id);

    const identity = document.createElement('div');
    identity.className = 'leaderboard-list__identity';

    const name = document.createElement('strong');
    name.textContent = `${entry.rank}. ${entry.name}`;

    if (entry.id === playerProfile.id) {
      const youTag = document.createElement('span');
      youTag.className = 'leaderboard-list__tag';
      youTag.textContent = 'YOU';
      identity.append(name, youTag);
    } else {
      identity.appendChild(name);
    }

    const score = document.createElement('span');
    score.textContent = `Level ${entry.level} · ${entry.xp} XP · ${entry.bestStreak} best streak`;

    item.append(identity, score);
    leaderboardList.appendChild(item);
  });
}

function getDisplayLeaderboard() {
  return Array.isArray(leaderboard)
    ? leaderboard.map((entry, index) => ({
        ...decorateClientProfile(entry),
        rank: Number(entry.rank) || index + 1,
      }))
    : [];
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

function formatUsageDuration(totalSeconds) {
  if (totalSeconds <= 0) {
    return '0m';
  }

  if (totalSeconds < 3600) {
    return `${Math.max(1, Math.round(totalSeconds / 60))}m`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
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

function getGuidanceText(direction, angle) {
  const absoluteAngle = Math.abs(angle);

  if (direction === 'Behind' || absoluteAngle > 135) {
    return 'Turn around';
  }

  if (absoluteAngle < 12) {
    return 'Straight ahead';
  }

  if (direction === 'Left') {
    return absoluteAngle > 60 ? 'Sharp left' : 'Turn left';
  }

  if (direction === 'Right') {
    return absoluteAngle > 60 ? 'Sharp right' : 'Turn right';
  }

  return 'Straight ahead';
}

function formatCategoryLabel(category) {
  return String(category || 'general')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const right = new THREE.Vector3().crossVectors(forward, upAxis).normalize();
  const angleRadians = Math.atan2(right.dot(toCollectible), forward.dot(toCollectible));
  return THREE.MathUtils.radToDeg(angleRadians);
}

function resetCollectibles() {
  collectibles.forEach((collectible) => {
    if (collectible.group?.isObject3D) {
      scene?.remove(collectible.group);
      collectible.group.traverse((object) => {
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    }
    collectible.ownedTextures?.forEach((texture) => texture.dispose());
  });
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
    if (localDemoActive) {
      status.textContent = collected
        ? 'Completed on this device'
        : collectible?.questionIndex
          ? `Question ${collectible.questionIndex + 1} of ${item.questions.length}`
          : 'Ready to play';
      const copy = document.createElement('div');
      copy.append(title, status);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'button button--secondary button--small local-orb-button';
      action.textContent = collected ? 'Completed' : collectible?.questionIndex ? 'Continue quiz' : 'Start quiz';
      action.disabled = collected;
      action.addEventListener('click', () => {
        if (collectible && !collectible.collected) openQuizForCollectible(collectible);
      });
      listItem.classList.add('local-orb-card');
      listItem.append(copy, action);
      gameList.appendChild(listItem);
      return;
    }

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
  return horizontalDistance(cameraWorldPosition, collectible.group.position);
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
  const right = new THREE.Vector3().crossVectors(forward, upAxis).normalize();
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
  const geometry = getSharedOrbGeometry('ground-shadow', () => {
    const circle = new THREE.CircleGeometry(0.28, 20);
    circle.rotateX(-Math.PI / 2);
    return circle;
  });

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

function handleResize() {
  if (!camera || !renderer) {
    return;
  }

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
