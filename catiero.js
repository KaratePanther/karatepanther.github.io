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
const EMOJI = { P1: '🐱', P2: '🐈‍⬛' };

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

const WEAPONS = {
  paw: { id: 'paw', label: 'Paw Boop' },
  sausage: { id: 'sausage', label: 'Sausage Bazooka', projectile: SAUSAGE },
  tuna: { id: 'tuna', label: 'Tuna Can Bomb', projectile: TUNA }
};

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
  keys.add(e.key);
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'r' || e.key === 'R') resetMatch();
  if (e.key === '1') setPlayerWeapon('p1', 'paw');
  if (e.key === '2') setPlayerWeapon('p1', 'sausage');
  if (e.key === '3') setPlayerWeapon('p1', 'tuna');
  if (e.key === '7') setPlayerWeapon('p2', 'paw');
  if (e.key === '8') setPlayerWeapon('p2', 'sausage');
  if (e.key === '9') setPlayerWeapon('p2', 'tuna');
});
document.addEventListener('keyup', (e) => keys.delete(e.key));

const touchStates = {
  p1: { left: false, right: false, jump: false, boop: false },
  p2: { left: false, right: false, jump: false, boop: false }
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
  const JUMP_THRESHOLD = 0.4;
  state.left = normX < -MOVE_THRESHOLD;
  state.right = normX > MOVE_THRESHOLD;
  state.jump = normY < -JUMP_THRESHOLD;
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
  state[action] = isActive;
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
  }
  touchButtons.forEach((btn) => btn.classList.remove('active'));
  joysticks.forEach((js) => resetJoystick(js));
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
  if (!isTouch) clearTouchStates();
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
    applyTouchUIMode();
  },
  { once: true }
);

window.addEventListener('resize', applyTouchUIMode);
window.addEventListener('orientationchange', applyTouchUIMode);

function updateWeaponButtonState() {
  weaponButtons.forEach((btn) => {
    const playerKey = btn.dataset.player;
    const weaponId = btn.dataset.weaponChoice;
    const player = playerKey === 'p1' ? p1 : p2;
    const isActive = !!player && player.activeWeapon === weaponId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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

// Helper
const now = () => performance.now();

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
      mood: MAX_MOOD,
      lastHitAt: -9999,
      // Attack state
      booping: false,
      boopStart: 0,
      scored: 0,
      activeWeapon: 'sausage',
      weaponCooldownUntil: 0
    },
    overrides
  );
}

let p1 = makePlayer(true);
let p2 = makePlayer(false);

updateWeaponButtonState();
joysticks.forEach((js) => resetJoystick(js));
applyTouchUIMode();

let game = {
  paused: false,
  shakeTime: 0,
  winner: null
};

const $p1Score = document.getElementById('p1Score');
const $p2Score = document.getElementById('p2Score');

function resetRound(deadPlayer, killer) {
  // screen shake a bit
  game.shakeTime = 120;
  // score
  if (killer) killer.scored++;
  updateScoreHUD();
  if (killer && killer.scored >= WIN_POINTS) {
    game.winner = killer.isP1 ? 'Player 1' : 'Player 2';
    return;
  }
  // respawn both to reduce spawn camping
  const p1Weapon = p1.activeWeapon;
  const p2Weapon = p2.activeWeapon;
  p1 = makePlayer(true, { activeWeapon: p1Weapon });
  p1.scored = $p1Score.textContent | 0; // preserve
  p2 = makePlayer(false, { activeWeapon: p2Weapon });
  p2.scored = $p2Score.textContent | 0;
  projectiles = [];
  impactFlashes = [];
  updateWeaponButtonState();
}

function resetMatch() {
  const p1Weapon = p1.activeWeapon;
  const p2Weapon = p2.activeWeapon;
  p1 = makePlayer(true, { activeWeapon: p1Weapon });
  p1.scored = 0;
  p2 = makePlayer(false, { activeWeapon: p2Weapon });
  p2.scored = 0;
  game.winner = null;
  game.paused = false;
  game.shakeTime = 0;
  projectiles = [];
  impactFlashes = [];
  updateScoreHUD();
  updateWeaponButtonState();
}

function updateScoreHUD() {
  $p1Score.textContent = p1.scored;
  $p2Score.textContent = p2.scored;
}

function togglePause() {
  game.paused = !game.paused;
}

function setPlayerWeapon(playerKey, weaponId) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return;
  const player = playerKey === 'p1' ? p1 : p2;
  if (!player) return;
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
  projectiles.push({
    owner: pl,
    weapon: 'sausage',
    x: px,
    y: py,
    w: 6,
    h: 4,
    vx: cfg.speed * pl.facing,
    vy: cfg.initialVy,
    spawnAt: t,
    gravityScale: cfg.gravityScale,
    config: cfg,
    active: true
  });
  pl.weaponCooldownUntil = t + cfg.fireCooldown;
  pl.vx -= 0.6 * pl.facing;
  return true;
}

function throwTunaBomb(pl) {
  const cfg = WEAPONS.tuna.projectile;
  const t = now();
  const px = pl.facing === 1 ? pl.x + pl.w - 1 : pl.x - 5;
  const py = pl.y + pl.h * 0.2;
  projectiles.push({
    owner: pl,
    weapon: 'tuna',
    x: px,
    y: py,
    w: 6,
    h: 6,
    vx: cfg.speed * pl.facing,
    vy: cfg.initialVy,
    spawnAt: t,
    gravityScale: cfg.gravityScale,
    config: cfg,
    active: true
  });
  pl.weaponCooldownUntil = t + cfg.fireCooldown;
  pl.vx -= 0.4 * pl.facing;
  return true;
}

// Physics helpers
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function collidePlatforms(pl) {
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
  const touch = touchStates[pl.isP1 ? 'p1' : 'p2'];
  const leftKey = pl.isP1 ? keys.has('a') || keys.has('A') : keys.has('ArrowLeft');
  const rightKey = pl.isP1 ? keys.has('d') || keys.has('D') : keys.has('ArrowRight');
  const jumpKey = pl.isP1 ? keys.has('w') || keys.has('W') : keys.has('ArrowUp');
  const boopKey = pl.isP1 ? keys.has('f') : keys.has('l') || keys.has('L');

  const left = leftKey || (touch && touch.left);
  const right = rightKey || (touch && touch.right);
  const jump = jumpKey || (touch && touch.jump);
  const boopK = boopKey || (touch && touch.boop);

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

  if (jump && pl.onGround) {
    pl.vy = JUMP_VEL;
    pl.onGround = false;
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
}

function resolveBoops(attacker, defender) {
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
      }
    }
  }
}

function explodeProjectile(pr) {
  if (!pr.active) return;
  pr.active = false;
  const t = now();
  const weapon = WEAPONS[pr.weapon];
  const cfg = weapon && weapon.projectile ? weapon.projectile : SAUSAGE;
  const splashSq = cfg.splashRadius * cfg.splashRadius;
  const cats = [p1, p2];
  for (const cat of cats) {
    if (cat === pr.owner) continue;
    const cx = cat.x + cat.w * 0.5;
    const cy = cat.y + cat.h * 0.5;
    const dx = cx - pr.x;
    const dy = cy - pr.y;
    if (dx * dx + dy * dy <= splashSq) {
      if (t - cat.lastHitAt > BOOP.iframes) {
        cat.lastHitAt = t;
        cat.mood -= cfg.moodDamage;
        const dir = dx === 0 ? (pr.owner && pr.owner.facing) || 1 : Math.sign(dx);
        cat.vx = dir * cfg.knockbackX;
        cat.vy = cfg.knockbackY;
      }
    }
  }
  const shake = pr.weapon === 'tuna' ? 200 : 160;
  game.shakeTime = Math.max(game.shakeTime, shake);
  impactFlashes.push({
    x: pr.x + pr.w * 0.5,
    y: pr.y + pr.h * 0.5,
    created: t,
    duration: cfg.flashDuration,
    weapon: pr.weapon
  });
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

    if (t - pr.spawnAt > cfg.lifetime) {
      explodeProjectile(pr);
      continue;
    }

    if (pr.x < -8 || pr.x > WIDTH + 8 || pr.y > HEIGHT + 8 || pr.y < -8) {
      pr.active = false;
      continue;
    }

    const hitbox = { x: pr.x, y: pr.y, w: pr.w, h: pr.h };
    for (const pf of platforms) {
      if (!pr.active) break;
      if (aabb(hitbox, pf)) {
        explodeProjectile(pr);
      }
    }
    if (!pr.active) continue;

    const targets = [p1, p2];
    for (const target of targets) {
      if (target === pr.owner) continue;
      if (aabb(hitbox, target)) {
        explodeProjectile(pr);
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

function moodColor(v) {
  const r = v / MAX_MOOD;
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
  const fill = Math.max(0, Math.round((pl.mood / MAX_MOOD) * (bw - 2)));
  drawPixelRect(mx + 1, my + 1, fill, bh - 2, moodColor(pl.mood));
}

function drawEmoji(pl) {
  // Draw a rounded pixel body as a shadow, then emoji above it
  drawPixelRect(pl.x, pl.y + pl.h - 2, pl.w, 2, 'rgba(0,0,0,0.35)');
  ctx.font = '12px serif'; // emoji size relative to internal pixels
  ctx.textBaseline = 'top';
  ctx.fillText(pl.isP1 ? EMOJI.P1 : EMOJI.P2, Math.floor(pl.x - 1), Math.floor(pl.y - 6));
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
    } else {
      drawPixelRect(pr.x, pr.y, pr.w, pr.h, '#ffdd57');
    }
  }
}

function drawWeaponIndicator(pl) {
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
  ctx.fillText(`${game.winner} wins! Press R to reset`, WIDTH / 2, HEIGHT / 2 - 8);
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

  if (!game.paused && !game.winner) {
    // Control & physics
    controlPlayer(p1);
    controlPlayer(p2);
    collidePlatforms(p1);
    collidePlatforms(p2);

    // Resolve boops
    resolveBoops(p1, p2);
    resolveBoops(p2, p1);
    updateProjectiles();
    updateImpactFlashes();

    // Check mood / scoring
    if (p1.mood <= 0) resetRound(p1, p2);
    if (p2.mood <= 0) resetRound(p2, p1);
  }
  if (game.paused || game.winner) {
    updateImpactFlashes();
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

    // Draw boop hit flashes (debug optional)
    // (kept minimal for MVP)

    drawEmoji(p1);
    drawMoodBar(p1);
    drawWeaponIndicator(p1);
    drawEmoji(p2);
    drawMoodBar(p2);
    drawWeaponIndicator(p2);
    drawWinner();
  });

  ctx.restore();

  requestAnimationFrame(step);
}

// Initialize
updateScoreHUD();
requestAnimationFrame(step);

// Accessibility: prevent arrow keys from scrolling page
window.addEventListener(
  'keydown',
  (e) => {
    const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (block.includes(e.key)) e.preventDefault();
  },
  { passive: false }
);
