import './style.css';

import * as THREE from 'three';

const RETICLE_RADIUS = 0.16;
const COLLECTIBLE_HEIGHT = 0.56;
const TOTAL_COLLECTIBLES = 3;
const REVEAL_DISTANCE_METERS = 2.2;
const INTERACTION_DISTANCE_METERS = 2.2;
const DB_NAME = 'quest-ar-progress';
const DB_VERSION = 1;
const PROGRESS_STORE = 'animalProgress';

const TRIVIA_COLLECTIBLES = [
  {
    id: 'panda',
    accent: '#d8f7ff',
    title: 'Panda',
    emoji: 'P',
    rarity: 'Bamboo Scout',
    trait: 'Quiet Walker',
    journalNote: 'A gentle panda sighting logged after tracking its quiet signal through the route.',
    questions: [
      {
        prompt: 'What food are pandas most famous for eating?',
        options: ['Bamboo', 'Acorns', 'Seaweed'],
        answer: 0,
      },
      {
        prompt: 'Pandas are native to which country?',
        options: ['Brazil', 'China', 'Canada'],
        answer: 1,
      },
      {
        prompt: 'What colors are giant pandas?',
        options: ['Black and white', 'Blue and gray', 'Red and gold'],
        answer: 0,
      },
    ],
  },
  {
    id: 'lion',
    accent: '#ffb35c',
    title: 'Lion',
    emoji: 'L',
    rarity: 'Savanna Badge',
    trait: 'Bold Roar',
    journalNote: 'A lion sighting earned by following a bold signal across the open route.',
    questions: [
      {
        prompt: 'What is a group of lions called?',
        options: ['A pack', 'A pride', 'A herd'],
        answer: 1,
      },
      {
        prompt: 'Which lion is known for having a large mane?',
        options: ['Adult male', 'Cub', 'Lioness'],
        answer: 0,
      },
      {
        prompt: 'Lions are often called the king of what?',
        options: ['The jungle', 'The ocean', 'The mountains'],
        answer: 0,
      },
    ],
  },
  {
    id: 'elephant',
    accent: '#9fb7ff',
    title: 'Elephant',
    emoji: 'E',
    rarity: 'Trail Giant',
    trait: 'Heavy Step',
    journalNote: 'An elephant sighting recorded after walking out to the farthest signal.',
    questions: [
      {
        prompt: 'What long body part do elephants use to grab things?',
        options: ['Trunk', 'Tail', 'Mane'],
        answer: 0,
      },
      {
        prompt: 'Elephants are known for having very large what?',
        options: ['Wings', 'Ears', 'Claws'],
        answer: 1,
      },
      {
        prompt: 'Which land animal is the largest?',
        options: ['Elephant', 'Wolf', 'Kangaroo'],
        answer: 0,
      },
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
const radarSummary = document.querySelector('#radar-summary');
const radarList = document.querySelector('#radar-list');
const journalSummary = document.querySelector('#journal-summary');
const journalList = document.querySelector('#journal-list');
const journalDetail = document.querySelector('#journal-detail');
const profileSummary = document.querySelector('#profile-summary');
const profileProgress = document.querySelector('#profile-progress');
const profileNearest = document.querySelector('#profile-nearest');
const profileOcclusion = document.querySelector('#profile-occlusion');
const profileFocus = document.querySelector('#profile-focus');
const tabBar = document.querySelector('#tab-bar');
const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
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
let savedAnimalProgress = {};
let selectedJournalAnimalId = TRIVIA_COLLECTIBLES[0].id;

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

function handleStartButtonInteraction(event) {
  if (event.type === 'touchend') {
    event.preventDefault();
  }

  if (startButton.disabled || startInteractionInFlight) {
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

    startButton.disabled = false;
    startButton.textContent = 'Start AR';

    if (!/GSA|; wv\)/i.test(userAgent)) {
      statusText.textContent = 'Ready. Start AR and scan the floor. The hidden animals will reveal only when you walk close.';
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
    startButton.textContent = 'Exit AR';
    statusText.textContent = 'Move your phone slowly to find the floor.';
  } catch (error) {
    startButton.disabled = false;
    startButton.textContent = 'Start AR';
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
  startButton.disabled = false;
  startButton.textContent = 'Start AR';
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
    statusText.textContent = stableFloorFrames > 0 ? 'Hold steady. The hidden animals are being placed across the route.' : 'Move your phone slowly until the floor is found.';
    return;
  }

  const collectible = getCenteredCollectible();

  if (!collectible) {
    const nearest = getNearestCollectible();
    if (nearest) {
      const nearestDistance = getCollectibleDistance(nearest);
      statusText.textContent = nearestDistance > REVEAL_DISTANCE_METERS
        ? `No animal visible yet. Closest signal is ${formatDistance(nearestDistance)} away; walk ${formatDistance(nearestDistance - REVEAL_DISTANCE_METERS)} closer to reveal it.`
        : 'An animal is nearby. Look around, center the visible animal, then tap it.';
    } else {
      statusText.textContent = 'All animals collected.';
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
  if (!reticle.visible || collectiblesSpawned) {
    return;
  }

  resetCollectibles();

  const floorPosition = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
  camera.getWorldPosition(cameraWorldPosition);
  const playerBase = new THREE.Vector3(cameraWorldPosition.x, floorPosition.y, cameraWorldPosition.z);
  const heading = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  heading.y = 0;

  if (heading.lengthSq() < 0.0001) {
    heading.set(0, 0, -1);
  }

  heading.normalize();
  const right = new THREE.Vector3().crossVectors(heading, upAxis).normalize().negate();
  const spawnSlots = shuffleArray([
    { angle: -1.25, distance: 6.2 },
    { angle: 0.05, distance: 10.4 },
    { angle: 1.25, distance: 14.6 },
  ]);

  collectibles = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).map((item, index) => {
    const slot = spawnSlots[index];
    const angle = slot.angle + (Math.random() - 0.5) * 0.08;
    const distance = slot.distance + (Math.random() - 0.5) * 0.24;
    const offset = heading.clone().multiplyScalar(Math.cos(angle) * distance).add(right.clone().multiplyScalar(Math.sin(angle) * distance));
    const position = playerBase.clone().add(offset);
    position.y = floorPosition.y;

    const collectible = createCollectible(item, position);
    scene.add(collectible.group);
    return collectible;
  });

  collectiblesSpawned = true;
  stableFloorFrames = 0;
  reticle.visible = false;
  updateCollectionHud();
  statusText.textContent = 'Three hidden animals spawned across the route. Use Radar distance and walk close until an animal appears.';
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

  const orbMaterial = new THREE.MeshStandardMaterial({
    color: item.accent,
    emissive: item.accent,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.18,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), orbMaterial);
  floatRig.add(orb);

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
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.82), cardMaterial);
  card.position.y = 0.3;
  floatRig.add(card);

  const hitArea = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 1.04),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide }),
  );
  hitArea.position.copy(card.position);
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
    orb,
    questionIndex: Math.min(progress.questionIndex || 0, item.questions.length),
    revealed: Boolean(progress.revealed || progress.collected),
    worldBaseY: COLLECTIBLE_HEIGHT,
    bobOffset: Math.random() * Math.PI * 2,
  };
}

function createCollectibleTexture(item) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const context = canvas.getContext('2d');

  context.fillStyle = '#08111f';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = item.accent;
  context.lineWidth = 18;
  context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  drawAnimalIcon(context, item, canvas.width / 2, 190);

  context.fillStyle = '#ffffff';
  context.font = '700 46px Arial';
  context.fillText(item.title, canvas.width / 2, 370);

  context.fillStyle = 'rgba(255,255,255,0.84)';
  context.font = '500 34px Arial';
  context.fillText('Walk Close + Tap', canvas.width / 2, 454);

  context.fillStyle = item.accent;
  context.font = '600 30px Arial';
  context.fillText('3 questions to log sighting', canvas.width / 2, 560);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawAnimalIcon(context, item, x, y) {
  context.save();

  if (item.id === 'panda') {
    context.fillStyle = '#0a1020';
    context.beginPath();
    context.arc(x - 58, y - 56, 34, 0, Math.PI * 2);
    context.arc(x + 58, y - 56, 34, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#f8fbff';
    context.beginPath();
    context.arc(x, y, 84, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#0a1020';
    context.beginPath();
    context.ellipse(x - 30, y - 14, 18, 28, -0.45, 0, Math.PI * 2);
    context.ellipse(x + 30, y - 14, 18, 28, 0.45, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x, y + 24, 13, 0, Math.PI * 2);
    context.fill();
  } else if (item.id === 'lion') {
    context.fillStyle = '#8a431f';
    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2;
      context.beginPath();
      context.arc(x + Math.cos(angle) * 68, y + Math.sin(angle) * 68, 32, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = '#ffb35c';
    context.beginPath();
    context.arc(x, y, 78, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#08111f';
    context.beginPath();
    context.arc(x - 26, y - 16, 8, 0, Math.PI * 2);
    context.arc(x + 26, y - 16, 8, 0, Math.PI * 2);
    context.arc(x, y + 20, 12, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = '#7c8da8';
    context.beginPath();
    context.ellipse(x - 66, y, 44, 64, -0.18, 0, Math.PI * 2);
    context.ellipse(x + 66, y, 44, 64, 0.18, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#9fb7ff';
    context.beginPath();
    context.arc(x, y - 10, 72, 0, Math.PI * 2);
    context.fill();
    context.fillRect(x - 18, y + 26, 36, 72);

    context.fillStyle = '#08111f';
    context.beginPath();
    context.arc(x - 24, y - 22, 7, 0, Math.PI * 2);
    context.arc(x + 24, y - 22, 7, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
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
    collectible.orb.rotation.y += 0.02;
    collectible.halo.rotation.z += 0.01;
    collectible.card.lookAt(cameraWorldPosition);
    collectible.hitArea.lookAt(cameraWorldPosition);

    const isHighlighted = collectible === highlightedCollectible;
    collectible.floatRig.scale.setScalar(isHighlighted ? 1.08 : 1);
    collectible.orb.material.emissiveIntensity = isHighlighted ? 0.9 : 0.55;
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
  quizIntro.textContent = 'Keep your streak going. Get all 3 right to add this animal to your collection.';
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

function handleQuizAnswer(answerIndex) {
  const collectible = activeQuiz;

  if (!collectible) {
    return;
  }

  const question = collectible.item.questions[collectible.questionIndex];

  if (answerIndex !== question.answer) {
    quizFeedback.textContent = 'Not quite. Take another shot, you are still in it.';
    return;
  }

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

  if (getCollectedCount() === TOTAL_COLLECTIBLES) {
    gameHint.textContent = 'All 3 hidden animals collected. Restart AR to play again.';
    statusText.textContent = 'All hidden animals collected. Nice work.';
    return;
  }

  gameHint.textContent = `${collectible.item.title} is yours. Keep walking; the remaining animals stay hidden until you get close.`;
  statusText.textContent = `${collectible.item.title} collected. Use Radar and keep walking to reveal the others.`;
}

function closeQuizPanel() {
  activeQuiz = null;
  quizPanel.classList.add('hidden');
  quizFeedback.textContent = '';

  if (collectiblesSpawned && getCollectedCount() < TOTAL_COLLECTIBLES) {
    gameHint.textContent = `Use Radar distance. Animals reveal inside ${formatDistance(REVEAL_DISTANCE_METERS)}; get within ${formatDistance(INTERACTION_DISTANCE_METERS)}, center, and tap.`;
  }
}

function updateCollectionHud() {
  const collectedCount = getCollectedCount();
  gameCount.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES} collected`;
  renderCollectibleList();

  if (!collectiblesSpawned) {
    gameHint.textContent = 'Find the floor first. The 3 hidden animals will be placed across a walking route.';
    return;
  }

  if (collectedCount === TOTAL_COLLECTIBLES) {
    gameHint.textContent = 'All hidden animals collected. Restart AR to play again.';
    return;
  }

  gameHint.textContent = `Use Radar distance. Animals reveal inside ${formatDistance(REVEAL_DISTANCE_METERS)}; get within ${formatDistance(INTERACTION_DISTANCE_METERS)}, center, and tap.`;
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
}

function updateRadarPanel() {
  if (!collectiblesSpawned) {
    radarSummary.textContent = 'Waiting for the floor lock so the radar can pick up signals.';
    radarList.replaceChildren();
    return;
  }

  const nearest = getNearestCollectible();
  radarSummary.textContent = nearest
    ? `${nearest.item.title} is closest at ${formatDistance(getCollectibleDistance(nearest))}. It appears at ${formatDistance(REVEAL_DISTANCE_METERS)} and opens at ${formatDistance(INTERACTION_DISTANCE_METERS)}.`
    : 'All signals collected.';

  radarList.replaceChildren();

  collectibles.forEach((collectible) => {
    const item = document.createElement('li');
    item.className = 'map-signal';

    const directionArrow = document.createElement('span');
    directionArrow.className = 'direction-arrow';

    const label = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = collectible.item.title;

    const meta = document.createElement('span');
    const distanceChip = document.createElement('span');
    distanceChip.className = 'distance-chip';

    if (collectible.collected) {
      directionArrow.textContent = '✓';
      meta.textContent = 'Collected';
      distanceChip.textContent = 'Done';
    } else {
      const distance = getCollectibleDistance(collectible);
      const direction = getCollectibleDirection(collectible);
      directionArrow.textContent = getDirectionArrow(direction);
      if (!collectible.revealed && distance > REVEAL_DISTANCE_METERS) {
        meta.textContent = `${direction} - hidden, walk ${formatDistance(distance - REVEAL_DISTANCE_METERS)} closer to reveal`;
      } else if (distance > INTERACTION_DISTANCE_METERS) {
        meta.textContent = `${direction} - found, walk ${formatDistance(distance - INTERACTION_DISTANCE_METERS)} closer to tap`;
      } else {
        meta.textContent = `${direction} - found, tap when centered`;
      }
      distanceChip.textContent = formatDistance(distance);
    }

    label.append(title, meta);
    item.append(directionArrow, label, distanceChip);
    radarList.appendChild(item);
  });
}

function updateJournalPanel() {
  const collectedCount = getCollectedCount();
  const lifetimeCollectedCount = TRIVIA_COLLECTIBLES.slice(0, TOTAL_COLLECTIBLES).filter((item) => getProgressForItem(item).collected).length;
  journalSummary.textContent = lifetimeCollectedCount
    ? `Achievement chart ${Math.round((lifetimeCollectedCount / TOTAL_COLLECTIBLES) * 100)}% complete. ${lifetimeCollectedCount} of ${TOTAL_COLLECTIBLES} animals logged.`
    : 'Tap an achievement square to inspect it. Finished animals unlock what you learned.';

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
      : 'Not found yet. Use Radar, walk close, and reveal this animal in AR.';

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

  profileSummary.textContent = collectedCount === TOTAL_COLLECTIBLES
    ? 'You cleared the whole route. Restart whenever you want another round.'
    : 'You are in the middle of a live AR hunt. Stay moving and keep the camera steady.';
  profileProgress.textContent = `${collectedCount}/${TOTAL_COLLECTIBLES}`;
  profileNearest.textContent = nearest ? `${nearest.item.title} ${formatDistance(getCollectibleDistance(nearest))}` : 'Cleared';
  profileOcclusion.textContent = hasDepthOcclusion ? 'On' : 'Unavailable';
  profileFocus.textContent = collectiblesSpawned ? 'Explore' : 'Scanning';
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

async function checkModelViewerAsset() {
  try {
    const response = await fetch('/models/animal.glb', { method: 'HEAD' });
    if (!response.ok) {
      modelWarning.classList.remove('hidden');
    }
  } catch {
    modelWarning.classList.remove('hidden');
  }
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
