// =============================
// Catiero MVP v0.1 (single-file -> split)
// Pixel platform arena + emoji cats
// =============================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

// --- Internal pixel resolution ---
const WIDTH = 320; // Low internal res for pixel feel
const HEIGHT = 180;
const SCALE_X = canvas.width / WIDTH;
const SCALE_Y = canvas.height / HEIGHT;

// Emoji font prep
const EMOJI = { P1: '🐱', P2: '🐈‍⬛', BOSS: '🕶️' };

// Game constants
const GRAVITY = 0.35;
const MOVE_SPEED = 1.2;
const JUMP_VEL = -5.6;
const MAX_FALL = 6.0;
const FRICTION_GROUND = 0.8;

const BOOP = {
  windup: 100, // ms before active
  active: 120, // ms hitbox duration
  cooldown: 600, // ms total lockout
  dmg: 20,
  kbX: 2.8,
  kbY: -2.0,
  iframes: 400 // ms of hurt invulnerability
};

const SAUSAGE = {
  fireCooldown: 600,
  speed: 3.6,
  initialVy: -0.3,
  gravityScale: 0.08,
  moodDamage: 35,
  knockbackX: 3.4,
  knockbackY: -1.6,
  lifetime: 2200,
  splashRadius: 16,
  flashDuration: 220
};

const TUNA = {
  fireCooldown: 900,
  speed: 2.4,
  initialVy: -1.4,
  gravityScale: 0.12,
  moodDamage: 45,
  knockbackX: 2.6,
  knockbackY: -2.8,
  lifetime: 2600,
  splashRadius: 28,
  flashDuration: 280
};

const MAX_MOOD = 100;
const WIN_POINTS = 5;
const RAD = Math.PI / 180;
const AIM_MIN = -75 * RAD;
const AIM_MAX = 65 * RAD;
const AIM_SPEED_PER_MS = 0.0024; // radians per ms while held
const AIM_IDLE_HIDE_MS = 1500;
const AIM_LINE_LEN = 18;
const AIM_CORE_LEN = 8;
const TAU = Math.PI * 2;

const WEAPONS = {
  paw: { id: 'paw', label: 'Paw Boop' },
  sausage: { id: 'sausage', label: 'Sausage Bazooka', projectile: SAUSAGE },
  tuna: { id: 'tuna', label: 'Tuna Can Bomb', projectile: TUNA }
};

const BOSS_STATS = {
  w: 18,
  h: 22,
  maxMood: 260,
  moveSpeed: 0.9,
  jumpVel: -6.2,
  fallClamp: 6.2
};

const BOSS_BOOP = {
  windup: 180,
  active: 140,
  cooldown: 850,
  dmg: 28,
  kbX: 3.4,
  kbY: -2.6,
  iframes: 400,
  range: 16,
  height: 12
};

const BOSS_ORB = {
  fireCooldown: 1100,
  speed: 3.2,
  initialVy: -0.3,
  gravityScale: 0.1,
  moodDamage: 42,
  knockbackX: 3.2,
  knockbackY: -2.1,
  lifetime: 2400,
  splashRadius: 22,
  flashDuration: 240
};

let audioCtx = null;
let masterGain = null;
const AUDIO_GAIN = 0.25;

function ensureAudioContext() {
  if (!game || !game.soundEnabled) return null;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = AUDIO_GAIN;
  masterGain.connect(audioCtx.destination);
  return audioCtx;
}

function playTone({ frequency = 440, duration = 0.2, type = 'sine', volume = 1, attack = 0.01, decay = 0.08 }) {
  const ctx = ensureAudioContext();
  if (!ctx || !masterGain) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  const nowTime = ctx.currentTime;
  const attackEnd = nowTime + attack;
  gain.gain.setValueAtTime(0, nowTime);
  gain.gain.linearRampToValueAtTime(volume, attackEnd);
  gain.gain.exponentialRampToValueAtTime(0.0001, attackEnd + Math.max(decay, 0.01) + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(nowTime);
  osc.stop(attackEnd + duration + decay);
}

function playNoise({ duration = 0.25, volume = 0.4 }) {
  const ctx = ensureAudioContext();
  if (!ctx || !masterGain) return;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  noise.connect(gain);
  gain.connect(masterGain);
  noise.start();
  noise.stop(ctx.currentTime + duration);
}

function playSound(name) {
  if (!game || !game.soundEnabled) return;
  switch (name) {
    case 'boopHit':
      playTone({ frequency: 520, duration: 0.12, type: 'square', volume: 0.3 });
      break;
    case 'sausageFire':
      playTone({ frequency: 320, duration: 0.18, type: 'sawtooth', volume: 0.28, attack: 0.01, decay: 0.1 });
      break;
    case 'tunaThrow':
      playTone({ frequency: 260, duration: 0.16, type: 'triangle', volume: 0.24, attack: 0.02, decay: 0.12 });
      break;
    case 'tunaBounce':
      playTone({ frequency: 180, duration: 0.14, type: 'sine', volume: 0.26, attack: 0.01, decay: 0.1 });
      break;
    case 'explosion':
      playNoise({ duration: 0.32, volume: 0.22 });
      break;
    case 'score':
      playTone({ frequency: 620, duration: 0.2, type: 'square', volume: 0.32 });
      playTone({ frequency: 880, duration: 0.24, type: 'square', volume: 0.24, attack: 0.02, decay: 0.1 });
      break;
    case 'menuOpen':
      playTone({ frequency: 480, duration: 0.12, type: 'triangle', volume: 0.22 });
      break;
    case 'menuClose':
      playTone({ frequency: 360, duration: 0.1, type: 'triangle', volume: 0.2 });
      break;
    default:
      break;
  }
}

const AI_LEVELS = {
  easy: {
    decisionInterval: 450,
    variance: 140,
    boopAggro: 0.55,
    boopRange: 12,
    jumpChance: 0.22,
    useWeapons: true,
    sausageRange: 32,
    tunaChance: 0,
    attackInterval: 900,
    aimVariance: 0.45, // radians noise
    aimSnap: 0.4
  },
  medium: {
    decisionInterval: 320,
    variance: 110,
    boopAggro: 0.72,
    boopRange: 14,
    jumpChance: 0.35,
    useWeapons: true,
    sausageRange: 38,
    tunaChance: 0.15,
    attackInterval: 720,
    aimVariance: 0.25,
    aimSnap: 0.55
  },
  hard: {
    decisionInterval: 200,
    variance: 90,
    boopAggro: 0.88,
    boopRange: 16,
    jumpChance: 0.52,
    useWeapons: true,
    sausageRange: 44,
    tunaChance: 0.25,
    attackInterval: 540,
    aimVariance: 0.12,
    aimSnap: 0.72
  }
};

let game;
let p1;
let p2;
let boss = null;

// Platforms (pixel rectangles)
// Each: x, y, w, h in world (WIDTH x HEIGHT)
const platforms = [
  { x: 0, y: 168, w: 320, h: 12 }, // ground
  { x: 40, y: 128, w: 64, h: 8 },
  { x: 216, y: 128, w: 64, h: 8 },
  { x: 128, y: 92, w: 64, h: 8 }
];

// Spawn pads
const spawns = [{ x: 24, y: 152 }, { x: 276, y: 152 }];

// Input state
const keys = new Set();
document.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key === 'p' || key === 'P') {
    e.preventDefault();
    togglePause();
    return;
  }

  if (!game) return;

  if (game.menuOpen || !game.started) {
    if (game.menuOpen) {
      if (key === 'Escape' && game.started) {
        e.preventDefault();
        closeMenu();
      }
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        $menuPrimaryBtn?.click();
      }
    }
    return;
  }

  if (key === 'r' || key === 'R') {
    e.preventDefault();
    resetMatch();
    return;
  }

  keys.add(key);
  if (key === '1') setPlayerWeapon('p1', 'paw');
  if (key === '2') setPlayerWeapon('p1', 'sausage');
  if (key === '3') setPlayerWeapon('p1', 'tuna');
  if (!game.aiEnabled) {
    if (key === '7') setPlayerWeapon('p2', 'paw');
    if (key === '8') setPlayerWeapon('p2', 'sausage');
    if (key === '9') setPlayerWeapon('p2', 'tuna');
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.key));

const touchStates = {
  p1: { left: false, right: false, jump: false, boop: false, aimY: 0 },
  p2: { left: false, right: false, jump: false, boop: false, aimY: 0 }
};

const touchButtons = Array.from(document.querySelectorAll('.touch-btn'));
const weaponButtons = Array.from(document.querySelectorAll('[data-weapon-choice]'));
const joystickElements = Array.from(document.querySelectorAll('.touch-joystick'));

const joysticks = joystickElements.map((el) => ({
  el,
  stick: el.querySelector('.touch-joystick__stick'),
  player: el.dataset.player,
  pointerId: null,
  centerX: 0,
  centerY: 0,
  radius: 0,
  limit: 0
}));

const $p1Score = document.getElementById('p1Score');
const $p2Score = document.getElementById('p2Score');
const $p1Label = document.getElementById('p1Label');
const $p2Label = document.getElementById('p2Label');
const $bossScore = document.getElementById('bossScore');
const $bossLabel = document.getElementById('bossLabel');
const $bossItem = document.querySelector('.scoreboard__item--boss');
const $menuOverlay = document.getElementById('menuOverlay');
const $menuToggleBtn = document.getElementById('menuToggleBtn');
const $menuCloseBtn = document.getElementById('menuCloseBtn');
const $menuPrimaryBtn = document.getElementById('menuPrimaryBtn');
const $menuRestartBtn = document.getElementById('menuRestartBtn');
const $touchRestartBtn = document.getElementById('touchRestartBtn');
const modeRadios = Array.from(document.querySelectorAll('input[name="cat-mode"]'));
const difficultyRadios = Array.from(document.querySelectorAll('input[name="cat-difficulty"]'));
const $difficultySection = document.getElementById('aiDifficultySection');
const $soundToggle = document.getElementById('soundToggle');
const weaponOptionInputs = Array.from(document.querySelectorAll('input[name="cat-weapon"]'));

if ($menuOverlay) {
  $menuOverlay.setAttribute('aria-hidden', 'false');
}

if ($touchRestartBtn) {
  $touchRestartBtn.addEventListener('click', () => {
    if (!game || !game.started) return;
    resetMatch();
  });
}

setTouchRestartVisibility(false);

let allowedWeapons = new Set(['paw', 'sausage', 'tuna']);
let lastOpponentMode = null;

function getDefaultWeapon() {
  if (allowedWeapons.has('sausage')) return 'sausage';
  if (allowedWeapons.has('tuna')) return 'tuna';
  return 'paw';
}

function ensureWeaponAllowed(weaponId) {
  if (allowedWeapons.has(weaponId)) return weaponId;
  const fallbacks = ['sausage', 'tuna', 'paw'];
  for (const option of fallbacks) {
    if (allowedWeapons.has(option)) return option;
  }
  return 'paw';
}

function enforceAllowedWeapons() {
  if (p1) {
    p1.activeWeapon = ensureWeaponAllowed(p1.activeWeapon);
  }
  if (p2) {
    p2.activeWeapon = ensureWeaponAllowed(p2.activeWeapon);
  }
}

function getAllowedWeaponsFromMenu() {
  if (!weaponOptionInputs.length) return Array.from(allowedWeapons);
  const selected = weaponOptionInputs.filter((input) => input.checked).map((input) => input.value);
  if (!selected.includes('paw')) selected.push('paw');
  return selected;
}

function applyAllowedWeapons(newList) {
  allowedWeapons = new Set(newList);
  if (!allowedWeapons.has('paw')) {
    allowedWeapons.add('paw');
  }
  enforceAllowedWeapons();
  updateWeaponButtonState();
}

function getCheckedValue(nodes, fallback) {
  const found = nodes.find((el) => el.checked);
  return found ? found.value : fallback;
}

function updateDifficultySectionVisibility() {
  const mode = getCheckedValue(modeRadios, 'ai');
  if ($difficultySection) {
    const show = mode === 'ai' || mode === 'boss' || mode === 'boss-coop';
    $difficultySection.style.display = show ? 'flex' : 'none';
  }
}

function updateSoundPreference(enabled) {
  if (!game) return;
  game.soundEnabled = !!enabled;
  if (masterGain) {
    masterGain.gain.value = game.soundEnabled ? AUDIO_GAIN : 0;
  }
  if ($soundToggle) {
    $soundToggle.checked = game.soundEnabled;
  }
}

function setTouchRestartVisibility(show) {
  if (!$touchRestartBtn) return;
  const isTouch = document.body?.classList?.contains('is-touch');
  const visible = !!(show && isTouch);
  $touchRestartBtn.classList.toggle('touch-restart-btn--visible', visible);
  $touchRestartBtn.setAttribute('aria-hidden', visible ? 'false' : 'true');
  $touchRestartBtn.disabled = !visible;
  fitGameToViewport();
}

const isP2AIControlled = () => game && (game.mode === 'ai' || game.mode === 'boss-coop');
const isBossMode = () => game && (game.mode === 'boss' || game.mode === 'boss-coop');

function updatePlayerLabels() {
  if ($p1Label) $p1Label.textContent = 'Player 1';
  if ($p2Label) {
    const mode = game ? game.mode : 'ai';
    const label = mode === 'boss-coop' ? 'CPU Buddy' : mode === 'ai' ? 'CPU' : 'Player 2';
    $p2Label.textContent = label;
  }
  if ($bossLabel) {
    $bossLabel.textContent = 'Boss';
  }
}

function updateBossVisibility() {
  if (!$bossItem) return;
  const visible = isBossMode();
  $bossItem.style.display = visible ? 'flex' : 'none';
  $bossItem.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function applyOpponentUIState(isAI) {
  const flag = !!isAI;
  document.body.classList.toggle('ai-opponent', flag);
  if (lastOpponentMode !== flag) {
    clearTouchStates();
  }
  lastOpponentMode = flag;
  updatePlayerLabels();
  updateBossVisibility();
}

function updateMenuUI() {
  const open = !!(game && game.menuOpen);
  if ($menuOverlay) {
    $menuOverlay.classList.toggle('hidden', !open);
    $menuOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if ($menuToggleBtn) {
    $menuToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if ($soundToggle) {
    $soundToggle.checked = !!(game && game.soundEnabled);
  }
  if ($menuRestartBtn) {
    $menuRestartBtn.style.display = game && game.started ? 'inline-flex' : 'none';
  }
  if ($menuPrimaryBtn && game) {
    let action = 'start';
    let label = 'Start Match';
    if (game.started && !game.winner) {
      action = 'continue';
      label = 'Continue Match';
    }
    if (game.winner) {
      action = 'new';
      label = 'New Match';
    }
    $menuPrimaryBtn.textContent = label;
    $menuPrimaryBtn.dataset.action = action;
  }
  if (game) {
    applyOpponentUIState(isP2AIControlled());
  }
  fitGameToViewport();
}

function openMenu() {
  if (!game) return;
  game.menuOpen = true;
  keys.clear();
  if (game.started && !game.winner) {
    game.paused = true;
    playSound('menuOpen');
  }
  updateMenuUI();
}

function closeMenu() {
  if (!game) return;
  game.menuOpen = false;
  if (game.started && !game.winner) {
    game.paused = false;
    playSound('menuClose');
  }
  updateMenuUI();
}

function startNewMatch() {
  const mode = getCheckedValue(modeRadios, 'ai');
  const difficulty = getCheckedValue(difficultyRadios, 'medium');
  const selectedWeapons = getAllowedWeaponsFromMenu();
  applyAllowedWeapons(selectedWeapons);
  if (!game) return;
  game.mode = mode;
  game.aiEnabled = mode === 'ai' || mode === 'boss-coop';
  game.bossMode = isBossMode();
  game.aiDifficulty = difficulty;
  game.started = true;
  game.winner = null;
  game.paused = false;
  game.menuOpen = false;
  updateSoundPreference(game.soundEnabled);
  applyOpponentUIState(isP2AIControlled());
  updateBossVisibility();
  resetMatch({ resetWeaponsToDefault: true });
  closeMenu();
}

function handlePrimaryButton() {
  if (!$menuPrimaryBtn || !game) return;
  const action = $menuPrimaryBtn.dataset.action;
  if (action === 'continue') {
    closeMenu();
  } else {
    ensureAudioContext();
    startNewMatch();
  }
}

function resetJoystick(js) {
  if (!js) return;
  js.pointerId = null;
  js.el.classList.remove('active');
  if (js.stick) {
    js.stick.style.transform = 'translate3d(0, 0, 0)';
  }
  const state = touchStates[js.player];
  if (state) {
    state.left = false;
    state.right = false;
    state.jump = false;
    state.aimY = 0;
  }
}

function updateJoystickFromPointer(js, clientX, clientY) {
  if (!js || !js.stick) return;
  if (!js.radius || !js.limit) {
    const rect = js.el.getBoundingClientRect();
    js.radius = rect.width / 2;
    const stickRect = js.stick.getBoundingClientRect();
    js.limit = Math.max(0, (rect.width - stickRect.width) / 2);
    js.centerX = rect.left + rect.width / 2;
    js.centerY = rect.top + rect.height / 2;
  }

  const dx = clientX - js.centerX;
  const dy = clientY - js.centerY;
  const radius = js.radius || 1;
  let normX = dx / radius;
  let normY = dy / radius;
  const magnitude = Math.hypot(normX, normY);
  if (magnitude > 1) {
    normX /= magnitude;
    normY /= magnitude;
  }
  if (magnitude < 0.1) {
    normX = 0;
    normY = 0;
  }

  const limit = js.limit || 0;
  js.stick.style.transform = `translate(${normX * limit}px, ${normY * limit}px)`;

  const state = touchStates[js.player];
  if (!state) return;
  const MOVE_THRESHOLD = 0.35;
  state.left = normX < -MOVE_THRESHOLD;
  state.right = normX > MOVE_THRESHOLD;
  const aimVal = -normY; // up on joystick aims upward
  state.aimY = Math.abs(aimVal) > 0.2 ? clamp(aimVal, -1, 1) : 0;
}

joysticks.forEach((js) => {
  if (!js.el || !js.stick) return;

  const handlePointerDown = (e) => {
    e.preventDefault();
    const rect = js.el.getBoundingClientRect();
    js.centerX = rect.left + rect.width / 2;
    js.centerY = rect.top + rect.height / 2;
    js.radius = rect.width / 2;
    js.limit = Math.max(0, (rect.width - js.stick.getBoundingClientRect().width) / 2);
    js.pointerId = e.pointerId;
    js.el.classList.add('active');
    if (js.el.setPointerCapture) {
      try {
        js.el.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    updateJoystickFromPointer(js, e.clientX, e.clientY);
  };

  const handlePointerMove = (e) => {
    if (js.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateJoystickFromPointer(js, e.clientX, e.clientY);
  };

  const handlePointerEnd = (e) => {
    if (js.pointerId !== e.pointerId) return;
    e.preventDefault();
    if (js.el.releasePointerCapture) {
      try {
        js.el.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
    resetJoystick(js);
  };

  js.el.addEventListener('pointerdown', handlePointerDown);
  js.el.addEventListener('pointermove', handlePointerMove);
  js.el.addEventListener('pointerup', handlePointerEnd);
  js.el.addEventListener('pointercancel', handlePointerEnd);
  js.el.addEventListener('pointerleave', handlePointerEnd);
});

function setTouchState(player, action, isActive, el) {
  const state = touchStates[player];
  if (!state) return;
  if (action in state) {
    state[action] = isActive;
  }
  if (el) el.classList.toggle('active', isActive);
}

touchButtons.forEach((btn) => {
  const player = btn.dataset.player;
  const action = btn.dataset.action;
  if (!player || !action) return;

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (btn.setPointerCapture) {
      try { btn.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    setTouchState(player, action, true, btn);
  });

  const release = (e) => {
    e.preventDefault();
    setTouchState(player, action, false, btn);
    if (btn.releasePointerCapture) {
      try { btn.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  };

  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
});

function clearTouchStates() {
  for (const player of Object.keys(touchStates)) {
    const st = touchStates[player];
    for (const action of Object.keys(st)) {
      st[action] = false;
    }
    st.aimY = 0;
  }
  touchButtons.forEach((btn) => btn.classList.remove('active'));
  joysticks.forEach((js) => resetJoystick(js));
  if (p2 && p2.aiControl) {
    p2.aiControl.left = false;
    p2.aiControl.right = false;
    p2.aiControl.jump = false;
    p2.aiControl.attack = false;
  }
  if (boss && boss.aiControl) {
    boss.aiControl.left = false;
    boss.aiControl.right = false;
    boss.aiControl.jump = false;
    boss.aiControl.attack = false;
  }
}

function fitGameToViewport() {
  if (!canvas) return;
  const wrap = document.querySelector('.wrap');
  if (!wrap) return;

  const isTouchMode = document.body?.classList?.contains('is-touch');
  const aspect = canvas.width && canvas.height ? canvas.width / canvas.height : WIDTH / HEIGHT;

  if (!isTouchMode) {
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.maxWidth = '100%';

    const viewport = window.visualViewport;
    const viewportHeight = viewport ? viewport.height : window.innerHeight;
    const rect = canvas.getBoundingClientRect();
    const topOffset = rect.top - (viewport ? viewport.offsetTop : 0);

    const touchControls = document.querySelector('.touch-controls');
    let bottomReserve = 16;
    if (touchControls) {
      const style = window.getComputedStyle(touchControls);
      if (style.display !== 'none') {
        bottomReserve = touchControls.getBoundingClientRect().height + 16;
      }
    }

    const availableHeight = Math.max(180, viewportHeight - topOffset - bottomReserve);
    if (availableHeight <= 0) return;

    const currentHeight = rect.height;
    const wrapRect = wrap.getBoundingClientRect();
    const maxWidth = wrapRect.width;

    if (availableHeight < currentHeight - 0.5) {
      const targetHeight = Math.max(180, availableHeight);
      let targetWidth = targetHeight * aspect;
      if (targetWidth > maxWidth) {
        targetWidth = maxWidth;
      }
      const adjustedHeight = targetWidth / aspect;
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${adjustedHeight}px`;
    } else {
      canvas.style.width = '100%';
      canvas.style.height = '';
    }
    return;
  }

  canvas.style.width = '';
  canvas.style.height = '';
  canvas.style.maxWidth = '100%';

  const viewport = window.visualViewport;
  const viewportHeight = viewport ? viewport.height : window.innerHeight;
  const viewportTop = viewport ? viewport.offsetTop : 0;
  const rect = canvas.getBoundingClientRect();
  let topOffset = rect.top - viewportTop;

  const hud = document.querySelector('header.hud');
  if (hud) {
    const hudRect = hud.getBoundingClientRect();
    const overlap = Math.max(0, hudRect.bottom + 12 - rect.top);
    topOffset = Math.max(0, topOffset - overlap);
  } else {
    topOffset = Math.max(0, topOffset);
  }

  const touchControls = document.querySelector('.touch-controls');
  let bottomReserve = 20;
  if (touchControls) {
    const style = window.getComputedStyle(touchControls);
    if (style.display !== 'none') {
      bottomReserve = touchControls.getBoundingClientRect().height + 16;
    }
  }

  const availableHeight = Math.max(180, viewportHeight - topOffset - bottomReserve);
  if (availableHeight <= 0) return;

  const wrapRect = wrap.getBoundingClientRect();
  const maxWidth = wrapRect.width;

  const maxHeightFromWidth = maxWidth / aspect;
  const targetHeight = Math.max(180, Math.min(availableHeight, maxHeightFromWidth));
  const targetWidth = targetHeight * aspect;

  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;

  // snap to integer pixels to keep crisp edges
  if (canvas.style.width.endsWith('px')) {
    const widthValue = parseFloat(canvas.style.width);
    if (Number.isFinite(widthValue)) {
      canvas.style.width = `${Math.round(widthValue)}px`;
    }
  }
  if (canvas.style.height.endsWith('px')) {
    const heightValue = parseFloat(canvas.style.height);
    if (Number.isFinite(heightValue)) {
      canvas.style.height = `${Math.round(heightValue)}px`;
    }
  }
}

window.addEventListener('blur', clearTouchStates);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    clearTouchStates();
  }
});

function applyTouchUIMode() {
  if (!document.body) return;
  const coarseQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  const isCoarse = coarseQuery.matches;
  const hasTouchPoints =
    (navigator.maxTouchPoints ?? 0) > 0 ||
    (navigator.msMaxTouchPoints ?? 0) > 0 ||
    'ontouchstart' in window;
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
  const isAndroid = /Android/.test(ua);
  const isTouch = isCoarse || hasTouchPoints || isIOS || isAndroid;
  document.body.classList.toggle('is-touch', isTouch);
  const touchControls = document.querySelector('.touch-controls');
  if (touchControls) {
    touchControls.style.display = isTouch ? 'flex' : 'none';
    touchControls.setAttribute('aria-hidden', isTouch ? 'false' : 'true');
  }
  if (!isTouch) clearTouchStates();
  setTouchRestartVisibility(isTouch && game && game.winner);
  fitGameToViewport();
}

const coarsePointerQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
if (typeof coarsePointerQuery.addEventListener === 'function') {
  coarsePointerQuery.addEventListener('change', applyTouchUIMode);
} else if (typeof coarsePointerQuery.addListener === 'function') {
  coarsePointerQuery.addListener(applyTouchUIMode);
}

window.addEventListener(
  'touchstart',
  () => {
    document.body.classList.add('is-touch');
    const touchControls = document.querySelector('.touch-controls');
    if (touchControls) {
      touchControls.style.display = 'flex';
      touchControls.setAttribute('aria-hidden', 'false');
    }
    applyTouchUIMode();
  },
  { once: true }
);

window.addEventListener('resize', applyTouchUIMode);
window.addEventListener('orientationchange', applyTouchUIMode);
window.addEventListener('resize', fitGameToViewport);
window.addEventListener('orientationchange', fitGameToViewport);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitGameToViewport);
  window.visualViewport.addEventListener('scroll', fitGameToViewport);
}

function updateWeaponButtonState() {
  weaponButtons.forEach((btn) => {
    const playerKey = btn.dataset.player;
    const weaponId = btn.dataset.weaponChoice;
    const player = playerKey === 'p1' ? p1 : p2;
    const isActive = !!player && player.activeWeapon === weaponId;
    const allowed = allowedWeapons.has(weaponId);
    const hideForAI = playerKey === 'p2' && game && (game.mode === 'ai' || game.mode === 'boss-coop');
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.disabled = !allowed || hideForAI;
    if (!allowed) {
      btn.setAttribute('aria-hidden', 'true');
    } else {
      btn.removeAttribute('aria-hidden');
    }
    if (btn.classList.contains('touch-weapon-btn')) {
      btn.style.display = allowed && !hideForAI ? '' : 'none';
    } else if (!allowed) {
      btn.style.display = 'none';
    } else {
      btn.style.display = '';
    }
  });
}

weaponButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const playerKey = btn.dataset.player;
    const weaponId = btn.dataset.weaponChoice;
    setPlayerWeapon(playerKey, weaponId);
  });
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    const playerKey = btn.dataset.player;
    const weaponId = btn.dataset.weaponChoice;
    setPlayerWeapon(playerKey, weaponId);
  });
});

modeRadios.forEach((radio) => radio.addEventListener('change', updateDifficultySectionVisibility));
updateDifficultySectionVisibility();

modeRadios.forEach((radio) =>
  radio.addEventListener('change', () => {
    updateDifficultySectionVisibility();
    if (!game || game.started) return;
    const selection = getCheckedValue(modeRadios, 'ai');
    const futureAI = selection === 'ai' || selection === 'boss-coop';
    const futureBoss = selection === 'boss' || selection === 'boss-coop';
    document.body.classList.toggle('ai-opponent', futureAI);
    if ($p2Label) {
      const label = selection === 'boss-coop' ? 'CPU Buddy' : futureAI ? 'CPU' : 'Player 2';
      $p2Label.textContent = label;
    }
    if ($bossItem) $bossItem.style.display = futureBoss ? 'flex' : 'none';
  })
);

if ($menuToggleBtn) {
  $menuToggleBtn.addEventListener('click', () => {
    if (!game) return;
    if (game.menuOpen) closeMenu();
    else openMenu();
  });
}

if ($menuCloseBtn) {
  $menuCloseBtn.addEventListener('click', () => {
    closeMenu();
  });
}

if ($menuPrimaryBtn) {
  $menuPrimaryBtn.addEventListener('click', handlePrimaryButton);
}

if ($menuRestartBtn) {
  $menuRestartBtn.addEventListener('click', () => {
    if (!game || !game.started) return;
    const mode = getCheckedValue(modeRadios, 'ai');
    const difficulty = getCheckedValue(difficultyRadios, 'medium');
    game.mode = mode;
    game.aiEnabled = mode === 'ai' || mode === 'boss-coop';
    game.bossMode = isBossMode();
    game.aiDifficulty = difficulty;
    applyOpponentUIState(isP2AIControlled());
    updatePlayerLabels();
    ensureAudioContext();
    resetMatch({ resetWeaponsToDefault: true });
    closeMenu();
  });
}

if ($soundToggle) {
  $soundToggle.addEventListener('change', (event) => {
    updateSoundPreference(event.target.checked);
  });
}

weaponOptionInputs.forEach((input) => {
  if (input.disabled) return;
  input.addEventListener('change', () => {
    applyAllowedWeapons(getAllowedWeaponsFromMenu());
  });
});

applyAllowedWeapons(getAllowedWeaponsFromMenu());

// Helper
const now = () => performance.now();
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const normalizeAngle = (a) => {
  let res = a;
  while (res > Math.PI) res -= TAU;
  while (res < -Math.PI) res += TAU;
  return res;
};

const livingPlayers = () => [p1, p2].filter((pl) => pl && pl.alive);

function getClosestLivingPlayer(from) {
  const candidates = livingPlayers();
  if (!candidates.length) return null;
  let best = candidates[0];
  let bestDist = Infinity;
  for (const pl of candidates) {
    const cx = pl.x + pl.w / 2;
    const cy = pl.y + pl.h / 2;
    const dx = cx - (from.x + from.w / 2);
    const dy = cy - (from.y + from.h / 2);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      best = pl;
      bestDist = dist;
    }
  }
  return best;
}

let projectiles = [];
let impactFlashes = [];

function makePlayer(isP1, overrides = {}) {
  return Object.assign(
    {
      isP1,
      x: isP1 ? spawns[0].x : spawns[1].x,
      y: isP1 ? spawns[0].y : spawns[1].y,
      w: 10,
      h: 12,
      vx: 0,
      vy: 0,
      onGround: false,
      facing: isP1 ? 1 : -1,
      lastFacing: isP1 ? 1 : -1,
      maxMood: MAX_MOOD,
      mood: MAX_MOOD,
      lastHitAt: -9999,
      // Attack state
      booping: false,
      boopStart: 0,
      aimAngle: 0,
      aimLastChanged: now(),
      scored: 0,
      activeWeapon: getDefaultWeapon(),
      weaponCooldownUntil: 0,
      alive: true,
      type: 'player',
      aiControl: { left: false, right: false, jump: false, attack: false },
      nextAIDecision: 0,
      nextAIAttack: 0
    },
    overrides
  );
}

function makeBoss() {
  return {
    isBoss: true,
    type: 'boss',
    x: WIDTH / 2 - BOSS_STATS.w / 2,
    y: 70,
    w: BOSS_STATS.w,
    h: BOSS_STATS.h,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: -1,
    lastFacing: -1,
    maxMood: BOSS_STATS.maxMood,
    mood: BOSS_STATS.maxMood,
    lastHitAt: -9999,
    booping: false,
    boopStart: 0,
    weaponCooldownUntil: 0,
    aimAngle: 0,
    aimLastChanged: now(),
    alive: true,
    aiControl: { left: false, right: false, jump: false, attack: false },
    nextAIDecision: 0,
    nextAIAttack: 0
  };
}

p1 = makePlayer(true);
p2 = makePlayer(false);

updateWeaponButtonState();
joysticks.forEach((js) => resetJoystick(js));
applyTouchUIMode();

game = {
  paused: false,
  shakeTime: 0,
  winner: null,
  started: false,
  menuOpen: true,
  mode: 'ai',
  aiEnabled: true,
  bossMode: false,
  aiDifficulty: 'medium',
  soundEnabled: true
};

applyOpponentUIState(isP2AIControlled());
updateSoundPreference(game.soundEnabled);
updateMenuUI();
updateWeaponButtonState();

function resetRound(deadPlayer, killer) {
  if (isBossMode()) return;
  // screen shake a bit
  game.shakeTime = 120;
  // score
  if (killer) killer.scored++;
  updateScoreHUD();
  playSound('score');
  if (killer && killer.scored >= WIN_POINTS) {
    game.winner = killer.isP1 ? 'Player 1' : 'Player 2';
    setTouchRestartVisibility(true);
    return;
  }
  // respawn both to reduce spawn camping
  const p1Weapon = ensureWeaponAllowed(p1.activeWeapon);
  const p2Weapon = ensureWeaponAllowed(p2.activeWeapon);
  p1 = makePlayer(true, { activeWeapon: p1Weapon });
  p1.scored = $p1Score.textContent | 0; // preserve
  p2 = makePlayer(false, { activeWeapon: p2Weapon });
  p2.scored = $p2Score.textContent | 0;
  projectiles = [];
  impactFlashes = [];
  if (game.aiEnabled) {
    p2.nextAIDecision = 0;
    p2.nextAIAttack = 0;
  }
  clearTouchStates();
  updateWeaponButtonState();
}

function resetMatch(options = {}) {
  const { resetWeaponsToDefault = false } = options;
  if (!game.started) return;
  game.aiEnabled = game.mode === 'ai' || game.mode === 'boss-coop';
  game.bossMode = isBossMode();
  const baseWeapon = getDefaultWeapon();
  const prevP1Weapon = p1 ? p1.activeWeapon : baseWeapon;
  const prevP2Weapon = p2 ? p2.activeWeapon : baseWeapon;
  const p1Weapon = resetWeaponsToDefault ? baseWeapon : ensureWeaponAllowed(prevP1Weapon);
  const p2Weapon = resetWeaponsToDefault ? baseWeapon : ensureWeaponAllowed(prevP2Weapon);
  p1 = makePlayer(true, { activeWeapon: p1Weapon });
  p1.scored = 0;
  p1.mood = p1.maxMood;
  p1.alive = true;
  p2 = makePlayer(false, { activeWeapon: p2Weapon });
  p2.scored = 0;
  p2.mood = p2.maxMood;
  p2.alive = true;
  boss = game.bossMode ? makeBoss() : null;
  game.winner = null;
  setTouchRestartVisibility(false);
  game.paused = false;
  game.shakeTime = 0;
  game.menuOpen = false;
  projectiles = [];
  impactFlashes = [];
  updateScoreHUD();
  clearTouchStates();
  keys.clear();
  if (game.aiEnabled) {
    setPlayerWeapon('p2', p2.activeWeapon || baseWeapon);
    p2.nextAIDecision = 0;
    p2.nextAIAttack = 0;
  }
  updateWeaponButtonState();
  updatePlayerLabels();
  updateBossVisibility();
}

function updateScoreHUD() {
  const bossMode = isBossMode();
  if (bossMode) {
    $p1Score.textContent = p1 ? Math.max(0, Math.round(p1.mood)) : 0;
    $p2Score.textContent = p2 ? Math.max(0, Math.round(p2.mood)) : 0;
    if ($bossScore) {
      $bossScore.textContent = boss && boss.alive ? Math.max(0, Math.round(boss.mood)) : boss ? '0' : '—';
    }
    return;
  }
  $p1Score.textContent = p1 ? p1.scored : 0;
  $p2Score.textContent = p2 ? p2.scored : 0;
  if ($bossScore) $bossScore.textContent = '—';
}

function markCatDown(cat) {
  if (!cat || !cat.alive) return;
  cat.alive = false;
  cat.mood = 0;
  cat.vx = 0;
  cat.vy = 0;
}

function handleBossWinStates() {
  if (!game || !game.bossMode) return;
  if (p1 && p1.alive && p1.mood <= 0) markCatDown(p1);
  if (p2 && p2.alive && p2.mood <= 0) markCatDown(p2);
  if (boss && boss.alive && boss.mood <= 0) {
    markCatDown(boss);
    game.winner = 'Team Cats';
    setTouchRestartVisibility(true);
    updateScoreHUD();
    return;
  }
  if ((!p1 || !p1.alive) && (!p2 || !p2.alive)) {
    game.winner = 'Snoop Dogg';
    setTouchRestartVisibility(true);
    updateScoreHUD();
  }
}

function togglePause() {
  if (!game.started || game.winner) return;
  if (game.menuOpen) closeMenu();
  else openMenu();
}

function setPlayerWeapon(playerKey, weaponId) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return;
  const player = playerKey === 'p1' ? p1 : p2;
  if (!player || !player.alive) return;
  if (!allowedWeapons.has(weaponId)) {
    weaponId = ensureWeaponAllowed(weaponId);
  }
  if (player.activeWeapon === weaponId) {
    updateWeaponButtonState();
    return;
  }
  player.activeWeapon = weaponId;
  player.weaponCooldownUntil = 0;
  player.booping = false;
  player.boopStart = 0;
  updateWeaponButtonState();
}

function fireSausage(pl) {
  const cfg = WEAPONS.sausage.projectile;
  const t = now();
  const px = pl.facing === 1 ? pl.x + pl.w : pl.x - 5;
  const py = pl.y + pl.h * 0.4;
  const base = pl.facing === 1 ? 0 : Math.PI;
  const shotAngle = base + (pl.aimAngle || 0);
  const vx = cfg.speed * Math.cos(shotAngle);
  const vy = cfg.speed * Math.sin(shotAngle) + cfg.initialVy;
  projectiles.push({
    owner: pl,
    weapon: 'sausage',
    x: px,
    y: py,
    w: 6,
    h: 4,
    vx,
    vy,
    spawnAt: t,
    gravityScale: cfg.gravityScale,
    config: cfg,
    active: true
  });
  pl.weaponCooldownUntil = t + cfg.fireCooldown;
  pl.vx -= 0.6 * pl.facing;
  playSound('sausageFire');
  return true;
}

function throwTunaBomb(pl) {
  const cfg = WEAPONS.tuna.projectile;
  const t = now();
  const px = pl.facing === 1 ? pl.x + pl.w - 1 : pl.x - 5;
  const py = pl.y + pl.h * 0.2;
  const base = pl.facing === 1 ? 0 : Math.PI;
  const shotAngle = base + (pl.aimAngle || 0);
  const vx = cfg.speed * Math.cos(shotAngle);
  const vy = cfg.speed * Math.sin(shotAngle) + cfg.initialVy;
  projectiles.push({
    owner: pl,
    weapon: 'tuna',
    x: px,
    y: py,
    w: 6,
    h: 6,
    vx,
    vy,
    spawnAt: t,
    gravityScale: cfg.gravityScale,
    config: cfg,
    active: true,
    bounces: 0,
    maxBounces: 4
  });
  pl.weaponCooldownUntil = t + cfg.fireCooldown;
  pl.vx -= 0.4 * pl.facing;
  playSound('tunaThrow');
  return true;
}

function fireBossOrb(b, target) {
  if (!b || !target) return false;
  const cfg = BOSS_ORB;
  const t = now();
  if (t < b.weaponCooldownUntil) return false;
  const bx = b.x + b.w * 0.5;
  const by = b.y + b.h * 0.4;
  const tx = target.x + target.w * 0.5;
  const ty = target.y + target.h * 0.5;
  const angle = Math.atan2(ty - by, tx - bx);
  const vx = cfg.speed * Math.cos(angle);
  const vy = cfg.speed * Math.sin(angle) + cfg.initialVy;
  projectiles.push({
    owner: b,
    weapon: 'bossOrb',
    x: bx,
    y: by,
    w: 7,
    h: 7,
    vx,
    vy,
    spawnAt: t,
    gravityScale: cfg.gravityScale,
    config: cfg,
    active: true
  });
  b.weaponCooldownUntil = t + cfg.fireCooldown;
  return true;
}

// Physics helpers
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collidePlatforms(pl) {
  if (!pl) return;
  pl.onGround = false;
  // vertical resolution first
  pl.y += pl.vy;
  // clamp to world
  if (pl.y + pl.h > HEIGHT) {
    pl.y = HEIGHT - pl.h;
    pl.vy = 0;
    pl.onGround = true;
  }
  if (pl.y < 0) {
    pl.y = 0;
    pl.vy = 0;
  }

  for (const pf of platforms) {
    if (aabb(pl, pf)) {
      // coming from top
      if (pl.vy >= 0 && pl.y + pl.h - pf.y < 8) {
        pl.y = pf.y - pl.h;
        pl.vy = 0;
        pl.onGround = true;
      } else if (pl.vy < 0 && pf.y + pf.h - pl.y < 8) {
        // hitting from below
        pl.y = pf.y + pf.h;
        pl.vy = 0;
      }
    }
  }

  // horizontal
  pl.x += pl.vx;
  if (pl.x < 0) {
    pl.x = 0;
    pl.vx = 0;
  }
  if (pl.x + pl.w > WIDTH) {
    pl.x = WIDTH - pl.w;
    pl.vx = 0;
  }
  for (const pf of platforms) {
    if (aabb(pl, pf)) {
      if (pl.vx > 0) pl.x = pf.x - pl.w;
      else if (pl.vx < 0) pl.x = pf.x + pf.w;
      pl.vx = 0;
    }
  }
}

function controlPlayer(pl) {
  if (!pl || pl.isBoss || !pl.alive) return;
  const isAI = game.aiEnabled && !pl.isP1;
  const touch = isAI ? null : touchStates[pl.isP1 ? 'p1' : 'p2'];
  const ai = isAI ? pl.aiControl : null;

  const leftKey = pl.isP1 ? keys.has('a') || keys.has('A') : (!isAI && (keys.has('ArrowLeft')));
  const rightKey = pl.isP1 ? keys.has('d') || keys.has('D') : (!isAI && (keys.has('ArrowRight')));
  const jumpKey = pl.isP1 ? keys.has('g') || keys.has('G') : (!isAI && (keys.has('k') || keys.has('K')));
  const boopKey = pl.isP1 ? keys.has('f') : (!isAI && (keys.has('l') || keys.has('L')));
  const aimUpKey = pl.isP1 ? keys.has('w') || keys.has('W') : (!isAI && keys.has('ArrowUp'));
  const aimDownKey = pl.isP1 ? keys.has('s') || keys.has('S') : (!isAI && keys.has('ArrowDown'));

  const left = !!leftKey || !!(touch && touch.left) || !!(ai && ai.left);
  const right = !!rightKey || !!(touch && touch.right) || !!(ai && ai.right);
  const jump = !!jumpKey || !!(touch && touch.jump) || !!(ai && ai.jump);
  const boopK = !!boopKey || !!(touch && touch.boop) || !!(ai && ai.attack);

  if (left) {
    pl.vx = -MOVE_SPEED;
    pl.facing = -1;
  }
  if (right) {
    pl.vx = MOVE_SPEED;
    pl.facing = 1;
  }
  if (!left && !right) {
    // friction when grounded
    if (pl.onGround) pl.vx *= FRICTION_GROUND;
    else pl.vx *= 0.99;
    if (Math.abs(pl.vx) < 0.02) pl.vx = 0;
  }

  // If facing flipped, mirror aim so elevation stays consistent to horizon
  if (pl.facing !== pl.lastFacing) {
    pl.aimAngle = clamp(-pl.aimAngle, AIM_MIN, AIM_MAX);
    pl.lastFacing = pl.facing;
    pl.aimLastChanged = now();
  }

  if (jump && pl.onGround) {
    pl.vy = JUMP_VEL;
    pl.onGround = false;
  }

  // Aim adjustment (Up/Down)
  const aimAnalog = touch ? touch.aimY || 0 : 0; // up on stick is positive
  let aimInput = 0;
  aimInput += aimDownKey ? 1 : 0;
  aimInput -= aimUpKey ? 1 : 0;
  aimInput -= aimAnalog; // subtract because analog up is positive
  const facingFactor = pl.facing === 1 ? 1 : -1;
  const aimDir = clamp(aimInput * facingFactor, -1, 1);
  if (aimDir !== 0) {
    const delta = AIM_SPEED_PER_MS * dtMs * aimDir;
    pl.aimAngle = clamp(pl.aimAngle + delta, AIM_MIN, AIM_MAX);
    pl.aimLastChanged = now();
  }

  // Start boop if possible
  const t = now();
  let usedRangedWeapon = false;
  if (boopK) {
    if (pl.activeWeapon === 'sausage') {
      if (t >= pl.weaponCooldownUntil) {
        usedRangedWeapon = fireSausage(pl);
      }
    } else if (pl.activeWeapon === 'tuna') {
      if (t >= pl.weaponCooldownUntil) {
        usedRangedWeapon = throwTunaBomb(pl);
      }
    } else if (!pl.booping) {
      pl.booping = true;
      pl.boopStart = t;
    }
  }
  if (usedRangedWeapon) {
    pl.booping = false;
  }

  // gravity
  pl.vy += GRAVITY;
  if (pl.vy > MAX_FALL) pl.vy = MAX_FALL;

  if (isAI && pl.aiControl) {
    pl.aiControl.jump = false;
    pl.aiControl.attack = false;
  }
}

function controlBoss(b) {
  if (!b || !b.alive) return;
  const ai = b.aiControl;
  const left = !!(ai && ai.left);
  const right = !!(ai && ai.right);
  const jump = !!(ai && ai.jump);
  const moveSpeed = BOSS_STATS.moveSpeed;

  if (left) {
    b.vx = -moveSpeed;
    b.facing = -1;
  }
  if (right) {
    b.vx = moveSpeed;
    b.facing = 1;
  }
  if (!left && !right) {
    if (b.onGround) b.vx *= FRICTION_GROUND;
    else b.vx *= 0.99;
    if (Math.abs(b.vx) < 0.02) b.vx = 0;
  }

  if (jump && b.onGround) {
    b.vy = BOSS_STATS.jumpVel;
    b.onGround = false;
  }

  b.vy += GRAVITY;
  if (b.vy > (BOSS_STATS.fallClamp || MAX_FALL)) b.vy = BOSS_STATS.fallClamp || MAX_FALL;

  if (ai) {
    ai.jump = false;
    ai.attack = false;
  }
}

function resolveBoops(attacker, defender) {
  if (!attacker || !defender) return;
  if (!attacker.alive || !defender.alive) return;
  if (attacker.activeWeapon !== 'paw') return;
  if (!attacker.booping) return;
  const t = now();
  const dt = t - attacker.boopStart;
  if (dt > BOOP.cooldown) {
    attacker.booping = false;
    return;
  }

  // Active window
  if (dt >= BOOP.windup && dt <= BOOP.windup + BOOP.active) {
    // Build a small hitbox in front
    const range = 12;
    const height = 10;
    const hb = {
      x: attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - range,
      y: attacker.y + (attacker.h - height) / 2,
      w: range,
      h: height
    };
    if (aabb(hb, defender)) {
      // Check i-frames
      if (t - defender.lastHitAt > BOOP.iframes) {
        defender.lastHitAt = t;
        defender.mood -= BOOP.dmg;
        // knockback
        defender.vx = attacker.facing * BOOP.kbX;
        defender.vy = BOOP.kbY;
        // tiny screen shake
        game.shakeTime = Math.max(game.shakeTime, 80);
        playSound('boopHit');
      }
    }
  }
}

function resolveBossBoop(attacker, defender) {
  if (!attacker || !defender) return;
  if (!attacker.isBoss || !attacker.alive || !defender.alive) return;
  if (!attacker.booping) return;
  const t = now();
  const dt = t - attacker.boopStart;
  if (dt > BOSS_BOOP.cooldown) {
    attacker.booping = false;
    return;
  }
  if (dt >= BOSS_BOOP.windup && dt <= BOSS_BOOP.windup + BOSS_BOOP.active) {
    const hb = {
      x: attacker.facing === 1 ? attacker.x + attacker.w : attacker.x - BOSS_BOOP.range,
      y: attacker.y + (attacker.h - BOSS_BOOP.height) / 2,
      w: BOSS_BOOP.range,
      h: BOSS_BOOP.height
    };
    if (aabb(hb, defender)) {
      if (t - defender.lastHitAt > BOSS_BOOP.iframes) {
        defender.lastHitAt = t;
        defender.mood -= BOSS_BOOP.dmg;
        defender.vx = attacker.facing * BOSS_BOOP.kbX;
        defender.vy = BOSS_BOOP.kbY;
        game.shakeTime = Math.max(game.shakeTime, 120);
        playSound('boopHit');
      }
    }
  }
}

function setAIAim(cat, target, cfg) {
  if (!cat || !target) return;
  const cx = cat.x + cat.w * 0.5;
  const cy = cat.y + cat.h * 0.5;
  const tx = target.x + target.w * 0.5;
  const ty = target.y + target.h * 0.5;
  const baseAngle = Math.atan2(ty - cy, tx - cx);
  const noise = (Math.random() * 2 - 1) * (cfg.aimVariance ?? 0.2);
  const desired = baseAngle + noise;
  const facingBase = cat.facing === 1 ? 0 : Math.PI;
  let rel = normalizeAngle(desired - facingBase);
  const clamped = clamp(rel, AIM_MIN, AIM_MAX);
  const snap = cfg.aimSnap ?? 0.5;
  cat.aimAngle = cat.aimAngle * (1 - snap) + clamped * snap;
  cat.aimLastChanged = now();
}

function updateAIControl(ai, target) {
  if (!game.started || !game.aiEnabled || !ai || !target) return;
  if (!ai.alive || !target.alive) return;
  const cfg = AI_LEVELS[game.aiDifficulty] || AI_LEVELS.medium;
  const t = now();
  if (t < ai.nextAIDecision) return;
  const control = ai.aiControl;
  if (!control) return;

  ai.nextAIDecision = t + cfg.decisionInterval + Math.random() * (cfg.variance || 0);

  control.left = false;
  control.right = false;
  control.attack = false;
  control.jump = false;

  const centerAx = ai.x + ai.w / 2;
  const centerTx = target.x + target.w / 2;
  const dx = centerTx - centerAx;
  const absDx = Math.abs(dx);
  if (absDx > 6) {
    control.left = dx < -6;
    control.right = dx > 6;
  }
  if (absDx > 2) {
    ai.facing = dx > 0 ? 1 : -1;
  }

  const dy = target.y - ai.y;
  const closeVertical = Math.abs((target.y + target.h / 2) - (ai.y + ai.h / 2)) < 12;
  const boopRange = cfg.boopRange ?? 14;
  const wantsBoop = absDx < boopRange && closeVertical && Math.random() < cfg.boopAggro;
  const canUseSausage = allowedWeapons.has('sausage');
  const canUseTuna = allowedWeapons.has('tuna');

  if (wantsBoop) {
    if (ai.activeWeapon !== 'paw') setPlayerWeapon('p2', 'paw');
    control.attack = true;
  } else if (cfg.useWeapons) {
    const shouldTuna =
      canUseTuna &&
      absDx > 20 &&
      Math.random() < (cfg.tunaChance || 0) &&
      t >= ai.nextAIAttack;
    if (shouldTuna) {
      setPlayerWeapon('p2', 'tuna');
      setAIAim(ai, target, cfg);
      control.attack = true;
      ai.nextAIAttack = t + cfg.attackInterval * 1.3;
    } else if (canUseSausage && absDx > (cfg.sausageRange ?? 36)) {
      if (ai.activeWeapon !== 'sausage') setPlayerWeapon('p2', 'sausage');
      if (t >= ai.nextAIAttack) {
        setAIAim(ai, target, cfg);
        control.attack = true;
        ai.nextAIAttack = t + cfg.attackInterval;
      }
    } else if (ai.activeWeapon !== 'paw') {
      setPlayerWeapon('p2', 'paw');
    }
  } else if (ai.activeWeapon !== 'paw') {
    setPlayerWeapon('p2', 'paw');
  }

  if (dy < -14 && ai.onGround && Math.random() < cfg.jumpChance) {
    control.jump = true;
  } else if (dy > 18 && Math.random() < cfg.jumpChance * 0.4) {
    control.jump = true;
  }
}

function updateBossControl(b, target) {
  if (!game.started || !game.bossMode || !b || !target) return;
  if (!b.alive || !target.alive) return;
  const cfg = AI_LEVELS[game.aiDifficulty] || AI_LEVELS.medium;
  const t = now();
  if (t < b.nextAIDecision) return;
  const control = b.aiControl;
  if (!control) return;
  b.nextAIDecision = t + cfg.decisionInterval + Math.random() * (cfg.variance || 0);

  control.left = false;
  control.right = false;
  control.jump = false;

  const bx = b.x + b.w / 2;
  const tx = target.x + target.w / 2;
  const dx = tx - bx;
  const absDx = Math.abs(dx);
  const dy = (target.y + target.h / 2) - (b.y + b.h / 2);

  if (absDx > 10) {
    control.left = dx < -10;
    control.right = dx > 10;
  } else {
    const jitter = Math.random() > 0.5 ? 1 : -1;
    control.left = jitter < 0;
    control.right = jitter > 0;
  }
  b.facing = dx >= 0 ? 1 : -1;

  if (b.onGround && Math.random() < cfg.jumpChance * 0.6 && Math.abs(dy) > 12) {
    control.jump = true;
  }

  const ready = t >= b.nextAIAttack;
  if (!ready) return;
  const closeVertical = Math.abs(dy) < 18;
  const wantsMelee = absDx < BOSS_BOOP.range + 4 && closeVertical && Math.random() < cfg.boopAggro;
  if (wantsMelee) {
    b.booping = true;
    b.boopStart = t;
    b.nextAIAttack = t + Math.max(BOSS_BOOP.cooldown, cfg.attackInterval);
  } else {
    const fired = fireBossOrb(b, target);
    if (fired) {
      setAIAim(b, target, cfg);
      b.nextAIAttack = t + cfg.attackInterval * 1.05;
    }
  }
}

function explodeProjectile(pr, options = {}) {
  if (!pr.active) return;
  pr.active = false;
  const { directTarget = null } = options;
  const t = now();
  const weapon = WEAPONS[pr.weapon];
  const cfg = weapon && weapon.projectile ? weapon.projectile : SAUSAGE;
  const splashSq = cfg.splashRadius * cfg.splashRadius;
  const px = pr.x + pr.w * 0.5;
  const py = pr.y + pr.h * 0.5;

  const tryHitCat = (cat, bypassRadius = false) => {
    if (!cat || cat === pr.owner) return;
    const cx = cat.x + cat.w * 0.5;
    const cy = cat.y + cat.h * 0.5;
    const dx = cx - px;
    const dy = cy - py;
    if (!bypassRadius && dx * dx + dy * dy > splashSq) return;
    if (t - cat.lastHitAt <= BOOP.iframes) return;
    cat.lastHitAt = t;
    cat.mood -= cfg.moodDamage;
    const dir = dx === 0 ? (pr.owner && pr.owner.facing) || 1 : Math.sign(dx);
    cat.vx = dir * cfg.knockbackX;
    cat.vy = cfg.knockbackY;
  };

  if (directTarget) {
    tryHitCat(directTarget, true);
  }

  const cats = [p1, p2, boss].filter(Boolean);
  for (const cat of cats) {
    tryHitCat(cat, false);
  }
  const shake = pr.weapon === 'tuna' ? 200 : 160;
  game.shakeTime = Math.max(game.shakeTime, shake);
  impactFlashes.push({
    x: px,
    y: py,
    created: t,
    duration: cfg.flashDuration,
    weapon: pr.weapon
  });
  playSound('explosion');
}

function updateProjectiles() {
  const t = now();
  for (const pr of projectiles) {
    if (!pr.active) continue;
    const weapon = WEAPONS[pr.weapon];
    const cfg = pr.config || (weapon && weapon.projectile) || SAUSAGE;
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += GRAVITY * (pr.gravityScale ?? cfg.gravityScale ?? 0.08);

    if (pr.weapon === 'tuna' && pr.active) {
      const bounceLimit = pr.maxBounces ?? 4;
      let bounced = false;
      const dampX = 0.82;
      const dampY = 0.7;
      if (pr.x <= 0) {
        pr.x = 0;
        pr.vx = Math.abs(pr.vx) * dampX;
        bounced = true;
      } else if (pr.x + pr.w >= WIDTH) {
        pr.x = WIDTH - pr.w;
        pr.vx = -Math.abs(pr.vx) * dampX;
        bounced = true;
      }
      if (pr.y <= 0) {
        pr.y = 0;
        pr.vy = Math.abs(pr.vy) * dampY;
        bounced = true;
      } else if (pr.y + pr.h >= HEIGHT) {
        pr.y = HEIGHT - pr.h;
        pr.vy = -Math.abs(pr.vy) * dampY;
        bounced = true;
      }
      if (bounced) {
        pr.bounces = (pr.bounces || 0) + 1;
        playSound('tunaBounce');
        if (Math.abs(pr.vx) < 0.4) {
          pr.vx = 0.4 * Math.sign(pr.vx || (pr.owner ? pr.owner.facing : 1));
        }
        if (Math.abs(pr.vy) < 0.4) {
          pr.vy = -0.45;
        }
        if (pr.bounces > bounceLimit) {
          explodeProjectile(pr);
          continue;
        }
      }
    }

    if (t - pr.spawnAt > cfg.lifetime) {
      explodeProjectile(pr);
      continue;
    }

    if (pr.x < -12 || pr.x > WIDTH + 12 || pr.y > HEIGHT + 12 || pr.y < -12) {
      pr.active = false;
      continue;
    }

    const hitbox = { x: pr.x, y: pr.y, w: pr.w, h: pr.h };
    if (pr.weapon === 'tuna') {
      for (const pf of platforms) {
        if (!pr.active) break;
        if (aabb(hitbox, pf)) {
          const overlapLeft = hitbox.x + hitbox.w - pf.x;
          const overlapRight = pf.x + pf.w - hitbox.x;
          const overlapTop = hitbox.y + hitbox.h - pf.y;
          const overlapBottom = pf.y + pf.h - hitbox.y;
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          const bounceLimit = pr.maxBounces ?? 4;
          if (minOverlap === overlapLeft) {
            pr.x = pf.x - pr.w;
            pr.vx = -Math.abs(pr.vx) * 0.82;
          } else if (minOverlap === overlapRight) {
            pr.x = pf.x + pf.w;
            pr.vx = Math.abs(pr.vx) * 0.82;
          } else if (minOverlap === overlapTop) {
            pr.y = pf.y - pr.h;
            pr.vy = -Math.abs(pr.vy) * 0.7;
          } else {
            pr.y = pf.y + pf.h;
            pr.vy = Math.abs(pr.vy) * 0.7;
          }
          pr.bounces = (pr.bounces || 0) + 1;
          playSound('tunaBounce');
          if (pr.bounces > bounceLimit) {
            explodeProjectile(pr);
            break;
          }
          hitbox.x = pr.x;
          hitbox.y = pr.y;
          break;
        }
      }
    } else {
      for (const pf of platforms) {
        if (!pr.active) break;
        if (aabb(hitbox, pf)) {
          explodeProjectile(pr);
        }
      }
    }
    if (!pr.active) continue;

    const targets = [p1, p2, boss].filter(Boolean);
    for (const target of targets) {
      if (target === pr.owner || !target.alive) continue;
      if (game && game.bossMode && pr.owner && pr.owner.type === 'player' && target.type === 'player') {
        continue;
      }
      if (aabb(hitbox, target)) {
        const opts = pr.weapon === 'tuna' ? { directTarget: target } : undefined;
        explodeProjectile(pr, opts);
        break;
      }
    }
  }
  projectiles = projectiles.filter((pr) => pr.active);
}

function updateImpactFlashes() {
  const t = now();
  impactFlashes = impactFlashes.filter((f) => t - f.created <= (f.duration ?? SAUSAGE.flashDuration));
}

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function moodColor(v, maxVal = MAX_MOOD) {
  const r = maxVal > 0 ? v / maxVal : 0;
  if (r > 0.6) return getComputedStyle(document.documentElement).getPropertyValue('--bar-green');
  if (r > 0.3) return getComputedStyle(document.documentElement).getPropertyValue('--bar-yellow');
  return getComputedStyle(document.documentElement).getPropertyValue('--bar-red');
}

function drawMoodBar(pl) {
  const bw = 18;
  const bh = 3;
  const mx = pl.x + (pl.w / 2) - bw / 2;
  const my = pl.y - 6;
  drawPixelRect(mx, my, bw, bh, '#000');
  const maxVal = pl.maxMood || MAX_MOOD;
  const fill = Math.max(0, Math.round((pl.mood / maxVal) * (bw - 2)));
  drawPixelRect(mx + 1, my + 1, fill, bh - 2, moodColor(pl.mood, maxVal));
}

function drawEmoji(pl) {
  // Draw a rounded pixel body as a shadow, then emoji above it
  drawPixelRect(pl.x, pl.y + pl.h - 2, pl.w, 2, 'rgba(0,0,0,0.35)');
  ctx.font = '12px serif'; // emoji size relative to internal pixels
  ctx.textBaseline = 'top';
  const glyph = pl.isBoss ? EMOJI.BOSS : pl.isP1 ? EMOJI.P1 : EMOJI.P2;
  ctx.fillText(glyph, Math.floor(pl.x - 1), Math.floor(pl.y - 6));
}

function drawPlatforms() {
  for (const pf of platforms) {
    // simple pixel platform with top highlight
    drawPixelRect(pf.x, pf.y, pf.w, pf.h, '#2b323a');
    drawPixelRect(pf.x, pf.y, pf.w, 2, '#3a424b');
  }
}

function drawProjectiles() {
  for (const pr of projectiles) {
    if (!pr.active) continue;
    if (pr.weapon === 'sausage') {
      drawPixelRect(pr.x, pr.y, pr.w, pr.h, '#ffb347');
      drawPixelRect(pr.x - 1, pr.y + pr.h / 2 - 1, 2, 2, '#df5f2d');
      drawPixelRect(pr.x + pr.w - 1, pr.y + pr.h / 2 - 1, 2, 2, '#ffe08a');
    } else if (pr.weapon === 'tuna') {
      drawPixelRect(pr.x, pr.y, pr.w, pr.h, '#8fb3ff');
      drawPixelRect(pr.x, pr.y, pr.w, 1, '#d8e6ff');
      drawPixelRect(pr.x, pr.y + pr.h - 1, pr.w, 1, '#6a89ff');
    } else if (pr.weapon === 'bossOrb') {
      drawPixelRect(pr.x, pr.y, pr.w, pr.h, '#b3ff7a');
      drawPixelRect(pr.x + 1, pr.y + 1, pr.w - 2, pr.h - 2, '#5e9d3f');
      drawPixelRect(pr.x, pr.y, pr.w, 1, '#e9ffd3');
    } else {
      drawPixelRect(pr.x, pr.y, pr.w, pr.h, '#ffdd57');
    }
  }
}

function drawWeaponIndicator(pl) {
  if (pl.isBoss) return;
  const labels = {
    paw: { text: 'Paw', color: '#ff8aa8' },
    sausage: { text: 'Saus', color: '#ffb347' },
    tuna: { text: 'Tuna', color: '#8fb3ff' }
  };
  const info = labels[pl.activeWeapon] || { text: '???', color: '#fff' };
  const text = info.text;
  ctx.save();
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const boxWidth = text.length * 4 + 6;
  const x = pl.x + pl.w / 2;
  const y = pl.y - 14;
  drawPixelRect(x - boxWidth / 2, y - 4, boxWidth, 8, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = info.color;
  ctx.fillText(text, Math.floor(x), Math.floor(y));
  ctx.restore();
}

function drawAimIndicator(pl) {
  if (pl.isBoss) return;
  const t = now();
  if (t - pl.aimLastChanged > AIM_IDLE_HIDE_MS) return;
  const originX = pl.x + pl.w / 2;
  const originY = pl.y + pl.h / 2;
  const base = pl.facing === 1 ? 0 : Math.PI;
  const angle = base + (pl.aimAngle || 0);
  const tipX = originX + Math.cos(angle) * AIM_LINE_LEN;
  const tipY = originY + Math.sin(angle) * AIM_LINE_LEN;
  const coreX = originX + Math.cos(angle) * AIM_CORE_LEN;
  const coreY = originY + Math.sin(angle) * AIM_CORE_LEN;

  ctx.save();
  ctx.strokeStyle = pl.isP1 ? '#ffdd57' : '#8fb3ff';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(originX, originY);
  ctx.lineTo(coreX, coreY);
  ctx.stroke();
  drawPixelRect(tipX - 2, tipY - 2, 4, 4, pl.isP1 ? '#ff8aa8' : '#6a89ff');
  ctx.restore();
}

function drawImpactFlashes() {
  if (!impactFlashes.length) return;
  const t = now();
  ctx.save();
  for (const flash of impactFlashes) {
    const age = t - flash.created;
    const duration = flash.duration ?? SAUSAGE.flashDuration;
    const alpha = Math.max(0, 1 - age / duration);
    if (alpha <= 0) continue;
    const palette =
      flash.weapon === 'tuna'
        ? { horizontal: '#b4cbff', vertical: '#6a89ff' }
        : { horizontal: '#ffdd57', vertical: '#ff8aa8' };
    ctx.globalAlpha = alpha * 0.9;
    drawPixelRect(flash.x - 6, flash.y - 1, 12, 2, palette.horizontal);
    drawPixelRect(flash.x - 1, flash.y - 6, 2, 12, palette.vertical);
  }
  ctx.restore();
}

function drawBackdrop() {
  // subtle pixel sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, '#14202a');
  g.addColorStop(1, '#0b0e10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // decorative stars/pixels
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 40; i++) {
    const x = (i * 53) % WIDTH;
    const y = (i * 29) % HEIGHT;
    drawPixelRect(x, y, 1, 1, '#cde');
  }
  ctx.globalAlpha = 1;
}

function drawWinner() {
  if (!game.winner) return;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  const isTouch = document.body?.classList?.contains('is-touch');
  const line1 = `${game.winner} wins!`;
  const line2 = isTouch ? 'Tap Restart to play again' : 'Press R to reset';
  ctx.fillText(line1, WIDTH / 2, HEIGHT / 2 - 12);
  ctx.fillText(line2, WIDTH / 2, HEIGHT / 2 + 8);
  ctx.textAlign = 'left';
}

function screenShakeWrap(drawFn) {
  if (game.shakeTime > 0) {
    const mag = 2; // pixels
    const ox = (Math.random() * 2 - 1) * mag;
    const oy = (Math.random() * 2 - 1) * mag;
    ctx.save();
    ctx.translate(ox, oy);
    drawFn();
    ctx.restore();
    game.shakeTime -= dtMs;
  } else {
    drawFn();
  }
}

let last = now();
let dtMs = 16;

function step() {
  const t = now();
  dtMs = Math.min(50, t - last);
  last = t;

  const playing = game.started && !game.paused && !game.winner;

  if (playing) {
    if (game.bossMode && boss) {
      if (game.aiEnabled) {
        updateAIControl(p2, boss);
      }
      const target = getClosestLivingPlayer(boss);
      if (target) updateBossControl(boss, target);
    } else if (game.aiEnabled) {
      updateAIControl(p2, p1);
    }
    // Control & physics
    controlPlayer(p1);
    controlPlayer(p2);
    if (game.bossMode && boss) controlBoss(boss);
    collidePlatforms(p1);
    collidePlatforms(p2);
    if (game.bossMode && boss) collidePlatforms(boss);

    // Resolve boops
    if (game.bossMode && boss) {
      resolveBoops(p1, boss);
      resolveBoops(p2, boss);
      resolveBossBoop(boss, p1);
      resolveBossBoop(boss, p2);
    } else {
      resolveBoops(p1, p2);
      resolveBoops(p2, p1);
    }
    updateProjectiles();
    updateImpactFlashes();

    // Check mood / scoring
    if (game.bossMode) {
      handleBossWinStates();
      updateScoreHUD();
    } else {
      if (p1.mood <= 0) resetRound(p1, p2);
      if (p2.mood <= 0) resetRound(p2, p1);
    }
  }
  if (!playing) {
    updateImpactFlashes();
    if (game.bossMode) updateScoreHUD();
  }

  // RENDER (to internal low-res then scaled by canvas CSS)
  // We'll draw directly at low-res coordinates; the canvas is already sized to 960x540 but we treat units as pixels on a 320x180 grid via integer math.

  // Scale context for crisp pixels
  ctx.save();
  ctx.scale(SCALE_X, SCALE_Y);

  screenShakeWrap(() => {
    drawBackdrop();
    drawPlatforms();
    drawProjectiles();
    drawImpactFlashes();
    drawAimIndicator(p1);
    drawAimIndicator(p2);
    if (boss) drawAimIndicator(boss);

    // Draw boop hit flashes (debug optional)
    // (kept minimal for MVP)

    drawEmoji(p1);
    drawMoodBar(p1);
    drawWeaponIndicator(p1);
    drawEmoji(p2);
    drawMoodBar(p2);
    drawWeaponIndicator(p2);
    if (boss) {
      drawEmoji(boss);
      drawMoodBar(boss);
      drawWeaponIndicator(boss);
    }
    drawWinner();
  });

  ctx.restore();

  requestAnimationFrame(step);
}

// Initialize
updateScoreHUD();
requestAnimationFrame(step);
fitGameToViewport();

// Accessibility: prevent arrow keys from scrolling page
window.addEventListener(
  'keydown',
  (e) => {
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (block.includes(e.key)) e.preventDefault();
  },
  { passive: false }
);

function preventViewportZoom() {
  const blockGesture = (event) => {
    event.preventDefault();
  };

  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  window.addEventListener('gesturestart', blockGesture, { passive: false });
  window.addEventListener('gesturechange', blockGesture, { passive: false });
  window.addEventListener('gestureend', blockGesture, { passive: false });

  let lastTouchEnd = 0;
  window.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 350) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );

  window.addEventListener(
    'dblclick',
    (event) => {
      event.preventDefault();
    },
    { passive: false }
  );
}

preventViewportZoom();
