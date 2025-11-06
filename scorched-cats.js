(()=>{
// =========================
// = Canvas & Core Setup  =
// =========================
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d', { alpha: true });
const stage = document.getElementById('stage');

const BASE_W = cvs.width, BASE_H = cvs.height;
const BIG_MAP_SCALE = 1.6;
let worldScale = 1;
let W = BASE_W, H = BASE_H;
const SKY = 0, SOLID = 1;
const PLAYER_R = 16;
const EXPLOSION_R = 34;
const G = 0.20;

let WIND_MAX = 0.05;       // scaled by menu
let wind = 0;

// Fit canvas to viewport with letterboxing
function fitCanvas(){
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.min(vw / W, vh / H);
  const cssW = Math.round(W * scale), cssH = Math.round(H * scale);
  cvs.style.width = cssW + 'px';  cvs.style.height = cssH + 'px';
  stage.style.width = cssW + 'px'; stage.style.height = cssH + 'px';
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);
fitCanvas();

// Prevent body scroll while playing (allow inside menu)
stage.addEventListener('touchmove', (e)=>{
  if (e.target.closest('.menuPanel')) return;
  e.preventDefault();
}, {passive:false});
document.addEventListener('dblclick', e => { if (stage.contains(e.target)) e.preventDefault(); }, {passive:false});

// ============
// = Elements =
// ============
const turnEl = document.getElementById('turn');
const windL = document.getElementById('windL');
const windR = document.getElementById('windR');
const windVal = document.getElementById('windVal');

const weaponBadge = document.getElementById('weaponBadge');
const weaponMenu  = document.getElementById('weaponMenu');
const weaponName  = document.getElementById('weaponName');
const weaponEmoji = document.getElementById('weaponEmoji');
const weaponMeta  = document.getElementById('weaponMeta');
const pipGrenade  = document.getElementById('pipGrenade');
const pipShotgun  = document.getElementById('pipShotgun');
const pipTeleport = document.getElementById('pipTeleport');
const pipNormal   = document.getElementById('pipNormal');
const fuseMini    = document.getElementById('fuseMini');

const fireBtn   = document.getElementById('fire');
const chargeBar = document.getElementById('chargeBar');
const zoomIn  = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const kbHelp  = document.getElementById('kbHelp');

const menuBtn   = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const modeSel   = document.getElementById('modeSel');
const diffSel   = document.getElementById('diffSel');
const windSel   = document.getElementById('windSel');
const timerSel  = document.getElementById('timerSel');
const moveSel   = document.getElementById('moveSel');
const waterSel  = document.getElementById('waterSel');
const waterFloodChk = document.getElementById('waterFloodChk');
const waterFloodSel = document.getElementById('waterFloodSel');
// Live-toggle movement + joystick when menu option changes
moveSel.addEventListener('change', () => {
  movementOn = (moveSel.value === 'on');
  if (isTouch && movementOn) showJoystick(); else hideJoystick();
});
if (waterSel) {
  waterSel.addEventListener('change', () => {
    readMenuSettings();
    updateWaterConfig(true);
    ensureWaterBelowPlayers();
    drawMiniPreview();
  });
}
if (waterFloodChk) {
  waterFloodChk.addEventListener('change', () => {
    readMenuSettings();
  });
}
if (waterFloodSel) {
  waterFloodSel.addEventListener('change', () => {
    readMenuSettings();
    updateWaterConfig(true);
    drawMiniPreview();
  });
}
const fallChk   = document.getElementById('fallChk');
const ammoChk   = document.getElementById('ammoChk');
const wShotgun  = document.getElementById('wShotgun');
const wGrenade  = document.getElementById('wGrenade');
const wTeleport = document.getElementById('wTeleport');
const bigMapChk = document.getElementById('bigMapChk');
const hillyChk = document.getElementById('hillyChk');
const spawnVarChk = document.getElementById('spawnVarChk');
const chaosChk  = document.getElementById('chaosChk');
const seedTxt   = document.getElementById('seedTxt');
const startBtn  = document.getElementById('startBtn');
const newMapBtn = document.getElementById('newMapBtn');
const closeMenu = document.getElementById('closeMenu');
const mini      = document.getElementById('mini');
const miniCtx   = mini.getContext('2d');

const banner        = document.getElementById('banner');
const winTxt        = document.getElementById('winTxt');
const statsTxt      = document.getElementById('statsTxt');
const rematchBtn    = document.getElementById('rematchBtn');
const newMapBannerBtn = document.getElementById('newMapBannerBtn');
const openMenuBtn   = document.getElementById('openMenuBtn');

const np1 = document.getElementById('np1');
const np2 = document.getElementById('np2');

const timerChip = document.getElementById('timerChip');
const timerVal  = document.getElementById('timerVal');

bigMapChk.addEventListener('change', () => {
  resetGame(true);
});

// Joystick
const joystick = document.getElementById('joystick');
const stick = joystick.querySelector('.stick');

// =====================
// = Audio (light sfx) =
// =====================
let audioCtx=null, chargeOsc=null, chargeGain=null;
function audio(){ if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function tone(freq=200, dur=0.1, type='square', gain=0.18){
  const ctx=audio(), t=ctx.currentTime;
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type; o.frequency.value=freq; o.connect(g); g.connect(ctx.destination);
  g.gain.setValueAtTime(gain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.start(t); o.stop(t+dur);
}
function noiseBoom(dur=0.35, startGain=0.35){
  const ctx=audio(), t=ctx.currentTime;
  const buffer = ctx.createBuffer(1, ctx.sampleRate*dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]= (Math.random()*2-1) * (1-i/data.length);
  const src=ctx.createBufferSource(); src.buffer=buffer;
  const g=ctx.createGain(); g.gain.setValueAtTime(startGain,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  src.connect(g); g.connect(ctx.destination); src.start(t);
}
function taDa(){ const ctx=audio(), t=ctx.currentTime, seq=[440,660,880];
  seq.forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='triangle'; o.frequency.value=f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, t+0.09*i);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.09*i+0.25);
    o.start(t+0.09*i); o.stop(t+0.09*i+0.25);
  });
}
function whoosh(){ const ctx=audio(), t=ctx.currentTime;
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(220,t); o.frequency.exponentialRampToValueAtTime(740,t+0.18);
  g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.22);
}
function poof(){ const ctx=audio(), t=ctx.currentTime;
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(600,t); o.frequency.exponentialRampToValueAtTime(240,t+0.15);
  g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.16);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.18);
}
function splash(){
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const dur = 0.28;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++){
    const progress = i / data.length;
    const decay = 1 - progress;
    data[i] = (Math.random() * 2 - 1) * decay * 0.65 + Math.sin(progress * Math.PI * 6) * 0.18;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  tone(520, 0.05, 'sine', 0.14);
}
function startChargeSound(){
  const ctx = audio();
  chargeOsc = ctx.createOscillator(); chargeGain = ctx.createGain();
  chargeOsc.type = 'sawtooth'; chargeOsc.frequency.setValueAtTime(220, ctx.currentTime);
  chargeGain.gain.setValueAtTime(0.08, ctx.currentTime);
  chargeOsc.connect(chargeGain); chargeGain.connect(ctx.destination); chargeOsc.start();
}
function updateChargeSound(pct){
  if (!chargeOsc) return; const ctx=audio(); const f=220 + pct*520;
  chargeOsc.frequency.linearRampToValueAtTime(f, ctx.currentTime + 0.05);
}
function stopChargeSound(){
  if (!chargeOsc) return; const ctx=audio(); const o=chargeOsc, g=chargeGain;
  chargeOsc=null; chargeGain=null; if (g) g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.08);
  if (o) o.stop(ctx.currentTime+0.1);
}

// ==================
// = RNG & Terrain  =
// ==================
let seed = Math.random().toString(36).slice(2,8);
function srand(s){ seed = s || Math.random().toString(36).slice(2,8); }
function rand(){ let x = 0; for (let i=0;i<seed.length;i++) x = (x*31 + seed.charCodeAt(i))>>>0;
  x ^= x<<13; x ^= x>>>17; x ^= x<<5; x>>>=0; seed = (x>>>0).toString(36).slice(0,6); return (x%1e9)/1e9; }

let mapSeed = '';

const terrCanvas = document.createElement('canvas'); terrCanvas.width=W; terrCanvas.height=H;
const terrCtx = terrCanvas.getContext('2d');
const decalCanvas = document.createElement('canvas'); decalCanvas.width=W; decalCanvas.height=H;
const decalCtx = decalCanvas.getContext('2d');
let terrainMask = new Uint8Array(W*H);
let heightmap = new Int16Array(W);

function setWorldScale(scale){
  const target = Math.max(1, scale);
  if (Math.abs(target - worldScale) < 0.001) return false;
  worldScale = target;
  W = Math.round(BASE_W * worldScale);
  H = Math.round(BASE_H * worldScale);

  cvs.width = W;
  cvs.height = H;
  terrCanvas.width = W;
  terrCanvas.height = H;
  decalCanvas.width = W;
  decalCanvas.height = H;

  terrainMask = new Uint8Array(W*H);
  heightmap = new Int16Array(W);

  fitCanvas();
  return true;
}

function generateTerrain(){
  terrCtx.clearRect(0,0,W,H);
  decalCtx.clearRect(0,0,W,H);
  terrainMask.fill(SKY); heightmap.fill(H);

  const base = new Float32Array(W);
  let y = H*0.55 + (rand()*80-40); let dy = 0;
  const roughAmp = hillierTerrainOn ? 2.8 : 2.3;
  const roughDamp = hillierTerrainOn ? 0.9 : 0.93;
  for(let x=0;x<W;x++){
    dy += (rand()-0.5)*roughAmp;
    dy*=roughDamp;
    y += dy;
    base[x]=y;
  }
  const smooth = new Float32Array(W);
  const K = hillierTerrainOn ? 9 : 12;
  let acc=0;
  for(let x=0;x<W+K;x++){ if(x<W) acc+=base[x]; if(x>=K) acc-=base[x-K];
    if(x>=K-1) smooth[x-(K-1)] = acc/Math.min(x+1,K,W);
  }
  for(let x=0;x<W;x++){
    let yy = smooth[x]
      + Math.sin(x*0.01)  * (hillierTerrainOn ? 28 : 18)
      + Math.sin(x*0.053) * (hillierTerrainOn ? 14 : 10)
      + Math.sin(x*0.018) * (hillierTerrainOn ? 10 : 6);
    if (hillierTerrainOn){
      yy += Math.sin(x*0.025) * 22;
      yy += Math.sin(x*0.18)  * 8;
    } else {
      yy += Math.sin(x*0.11) * 4;
    }
    yy = Math.max(H*0.35, Math.min(H*0.85, yy));
    heightmap[x] = Math.floor(yy);
  }
  const img = terrCtx.getImageData(0,0,W,H);
  const d = img.data;
  for(let x=0;x<W;x++){
    for(let y=heightmap[x]|0;y<H;y++){
      const idx = y*W+x; terrainMask[idx]=SOLID; const p=idx*4;
      d[p]=24; d[p+1]=32; d[p+2]=58; d[p+3]=255;
    }
  }
  terrCtx.putImageData(img,0,0);

  if (scatterDebrisOn) applyChaosTerrain();

  terrCtx.strokeStyle = '#2ecc71'; terrCtx.lineWidth=2; terrCtx.beginPath();
  for(let x=0;x<W;x++) terrCtx.lineTo(x+0.5, heightmap[x]-1.5);
  terrCtx.stroke();

  placePlayers();
  randomizeWind();
  drawMiniPreview();
}

function applyChaosTerrain(){
  const craterCount = 1 + Math.floor(rand()*3); // 1-3 surface gouges
  for(let i=0;i<craterCount;i++){
    const radius = 18 + rand()*26;
    const x = Math.floor(60 + rand()*(W-120));
    const surface = heightmap[Math.max(0, Math.min(W-1, x))];
    const cy = Math.max(radius*0.4, Math.min(H-4, surface - radius*0.45 + rand()*10));
    carveCrater(x, cy, radius);
  }

  const blobCount = 2 + Math.floor(rand()*3); // 2-4 airborne dirt blobs
  for(let i=0;i<blobCount;i++){
    const radius = 14 + rand()*18;
    const x = Math.floor(80 + rand()*(W-160));
    const base = heightmap[Math.max(0, Math.min(W-1, x))];
    const cy = Math.max(radius+6, base - 36 - rand()*110);
    addFloatingBlob(x, cy, radius);
  }
}

function placePlayers(){
  function findSurfaceX(x0,x1, preference){
    const min = Math.floor(Math.min(x0, x1));
    const max = Math.floor(Math.max(x0, x1));
    const span = Math.max(1, max - min);
    let best = null;
    for(let tries=0;tries<500;tries++){
      const x = min + Math.floor(rand()*span);
      const y = heightmap[Math.max(0, Math.min(W-1, x))] - PLAYER_R;
      if (y>0 && y<H-PLAYER_R){
        const left = heightmap[Math.max(0,x-6)];
        const right= heightmap[Math.min(W-1,x+6)];
        if (Math.abs(left-right) < 20){
          if (!preference) return {x,y};
          if (!best ||
             (preference==='high' && y < best.y) ||
             (preference==='low'  && y > best.y)){
            best = {x,y};
          }
        }
      }
    }
    if (best) return best;
    const mid = Math.floor((min+max)/2);
    return {x:mid, y:heightmap[Math.max(0, Math.min(W-1, mid))]-PLAYER_R};
  }

  const leftPref = varySpawnHeights ? 'high' : null;
  const rightPref = varySpawnHeights ? 'low' : null;

  let leftSpawn = findSurfaceX(40, W/2-80, leftPref);
  let rightSpawn = findSurfaceX(W/2+80, W-40, rightPref);

  if (Math.abs(rightSpawn.x - leftSpawn.x) < 220){
    rightSpawn = findSurfaceX(W-200, W-40, rightPref);
  }

  if (varySpawnHeights){
    const leftOptions = [
      leftSpawn,
      findSurfaceX(40, W/2-120, 'high'),
      findSurfaceX(60, W/2-100, 'high'),
    ];
    const rightOptions = [
      rightSpawn,
      findSurfaceX(W-220, W-40, 'low'),
      findSurfaceX(W/2+80, W-40, 'low'),
      findSurfaceX(W/2+100, W-70, 'low'),
    ];

    let bestLeft = leftSpawn;
    let bestRight = rightSpawn;
    let bestDelta = Math.abs(rightSpawn.y - leftSpawn.y);
    const minSep = 200;

    leftOptions.forEach(l=>{
      rightOptions.forEach(r=>{
        if (!l || !r) return;
        if (Math.abs(r.x - l.x) < minSep) return;
        const delta = Math.abs(r.y - l.y);
        if (delta > bestDelta + 4){
          bestDelta = delta;
          bestLeft = l;
          bestRight = r;
        }
      });
    });

    if (bestDelta < 45){
      for(let i=0;i<8;i++){
        const cand = findSurfaceX(W/2+70, W-40, (i%2===0)?'low':null);
        if (!cand) continue;
        if (Math.abs(cand.x - bestLeft.x) < minSep) continue;
        const delta = Math.abs(cand.y - bestLeft.y);
        if (delta > bestDelta){
          bestDelta = delta;
          bestRight = cand;
          if (delta >= 60) break;
        }
      }
    }

    leftSpawn = bestLeft;
    rightSpawn = bestRight;
  }

  if (Math.abs(rightSpawn.x - leftSpawn.x) < 200){
    const fallback = findSurfaceX(W-200, W-40, rightPref);
    if (Math.abs(fallback.x - leftSpawn.x) >= 200){
      rightSpawn = fallback;
    }
  }

  Object.assign(players[0], {x:leftSpawn.x, y:leftSpawn.y, vx:0, vy:0, facing:1, angle:45, ragdoll:null, slideBoost:0, turnLockedUntil:0, stunnedReason:null});
  Object.assign(players[1], {x:rightSpawn.x, y:rightSpawn.y, vx:0, vy:0, facing:-1, angle:135, ragdoll:null, slideBoost:0, turnLockedUntil:0, stunnedReason:null});

  ensureWaterBelowPlayers();
}

// Helpers
function groundYAt(x, hintY){
  x = Math.max(0, Math.min(W-1, x|0));
  if (hintY === undefined) return heightmap[x];

  let y = Math.max(0, Math.min(H-1, Math.floor(hintY)));
  const idx = y*W + x;
  if (terrainMask[idx] === SOLID){
    while (y>0 && terrainMask[(y-1)*W + x] === SOLID) y--;
    return y;
  } else {
    while (y < H && terrainMask[y*W + x] !== SOLID) y++;
    return y < H ? y : H;
  }
}
function isSolidAt(x, y){
  const xi = Math.max(0, Math.min(W-1, Math.floor(x)));
  const yi = Math.max(0, Math.min(H-1, Math.floor(y)));
  return terrainMask[yi*W + xi] === SOLID;
}

// ===================
// = Game State     =
// ===================
const Weapons = { NORMAL:'normal', GRENADE:'grenade', SHOTGUN:'shotgun', TELEPORT:'teleport' };
const EMOJI   = { normal:'🚀', grenade:'💣', shotgun:'🔫', teleport:'🌀' };

const players = [
  { name:'P1', emoji:'😼', color:'#6ea8fe', x:0, y:0, vx:0, vy:0, hp:100, angle:45, facing:1,
    emote:null, emoteT:0, lastPower:50, lastWeapon:Weapons.NORMAL, fuse:5, // default 5s
    ammo:{ shotgun:5, grenade:5, teleport:1 }, drowning:null, ragdoll:null, slideBoost:0, turnLockedUntil:0, stunnedReason:null },
  { name:'P2', emoji:'😺', color:'#90c2ff', x:0, y:0, vx:0, vy:0, hp:100, angle:135, facing:-1,
    emote:null, emoteT:0, lastPower:50, lastWeapon:Weapons.NORMAL, fuse:5,
    ammo:{ shotgun:5, grenade:5, teleport:1 }, drowning:null, ragdoll:null, slideBoost:0, turnLockedUntil:0, stunnedReason:null }
];
let turn = 0;
let weapon = Weapons.NORMAL;

let aiEnabled = true;
let shot = null;
let particles = [];
let rings = [];
let dmgNums = [];
const stats = { shots:[0,0], hits:[0,0], bestHit:[0,0] };
let placingTeleport = false;

const aiMemory = { lastSolution: null };
const aiState = {
  moveTask: null,
  pendingPlan: null
};

function resetAIState() {
  aiState.moveTask = null;
  aiState.pendingPlan = null;
}

// Movement options & state
let movementOn = true;
let bigMapOn = false;
let hillierTerrainOn = false;
let varySpawnHeights = false;
let scatterDebrisOn = false;
const MOVE = {
  accel: 0.06,
  max: 0.8,
  friction: 0.965,
  jumpVy: -3.6,
  hopBoost: 1.2,
  jumpCooldown: 300,
  coyoteMs: 120,
  bufferMs: 120,
};
const WATER_MODES = {
  off: { depthRatio: 0 },
  shallow: { depthRatio: 0.1 },
  medium: { depthRatio: 0.16 },
  deep: { depthRatio: 0.22 }
};
const FLOOD_SPEED_MULTS = {
  slow: 0.55,
  normal: 1,
  fast: 1.6
};
const WATER_MIN_DEPTH = 18;
const WATER_FLOOD_RATIO = 0.035;
const DROWN_DURATION = 1400;
const RAGDOLL_MIN_MS = 520;
const SHOTGUN_RAGDOLL_MS = 360;
const FALL_STUN_THRESHOLD = 82;
const FALL_STUN_DURATION = 900;
const BLAST_STUN_DURATION = 750;
const SLIDE_DECAY = 0.92;
const SLIDE_BONUS_MAX = 8;
let waterMode = 'shallow';
let waterFloodEnabled = false;
let waterFloodSpeed = 'normal';
let waterLevelY = H + 999;
let waterBaseLevelY = H + 999;
let waterFloodStep = 0;
let waterAnimT = 0;
let allowInput = true; // blocked during projectile & menu
let keys = {};
let lastGroundedAt = [0,0];   // timestamps per player
let lastJumpPressedAt = [0,0];
let lastJumpAt = [ -9999, -9999 ];
let pendingWinner = null;

function now(){ return performance.now(); }

function waterIsActive(){
  return waterLevelY < H - 1;
}

function updateWaterConfig(resetLevel = false){
  const cfg = WATER_MODES[waterMode] || WATER_MODES.off;
  if (!cfg || cfg.depthRatio <= 0){
    waterBaseLevelY = H + 999;
    waterFloodStep = 0;
    if (resetLevel) {
      waterLevelY = H + 999;
    }
    return;
  }
  const depthPx = Math.max(WATER_MIN_DEPTH, Math.round(H * cfg.depthRatio));
  const base = Math.max(PLAYER_R + 12, H - depthPx);
  waterBaseLevelY = base;
  const speedMult = waterFloodEnabled ? (FLOOD_SPEED_MULTS[waterFloodSpeed] ?? 1) : 0;
  waterFloodStep = speedMult > 0 ? Math.max(4, Math.round(H * WATER_FLOOD_RATIO * speedMult)) : 0;
  if (resetLevel || waterLevelY > H){
    waterLevelY = base;
  } else {
    waterLevelY = Math.max(2, Math.min(waterLevelY, H));
  }
}

function waterPenaltyForFeet(feetY){
  if (!waterIsActive()) return 0;
  const buffer = 18;
  if (feetY + buffer < waterLevelY) return 0;
  const depth = feetY + buffer - waterLevelY;
  return depth * 14;
}

function isRagdollActive(p){
  return !!(p && p.ragdoll && now() < p.ragdoll.until);
}

function clearRagdoll(p){
  if (!p) return;
  p.ragdoll = null;
}

function applyImpact(p, impulse = { vx:0, vy:0 }, opts = {}){
  if (!p || p.drowning) return;
  const nowTime = now();
  const ragMs = opts.ragdollMs || RAGDOLL_MIN_MS;
  const until = nowTime + ragMs;
  const rag = p.ragdoll && p.ragdoll.until > nowTime ? p.ragdoll : { until, airDrag: opts.airDrag || 0.985 };
  rag.until = Math.max(rag.until || 0, until);
  rag.airDrag = opts.airDrag || rag.airDrag;
  p.ragdoll = rag;
  if (impulse.vx) p.vx += impulse.vx;
  if (impulse.vy) p.vy += impulse.vy;
  const boost = opts.slideBoost || Math.abs(impulse.vx || 0) * 0.7;
  if (boost) p.slideBoost = Math.min(SLIDE_BONUS_MAX, Math.max(p.slideBoost || 0, boost));
  if (opts.stunMs){
    p.turnLockedUntil = Math.max(p.turnLockedUntil || 0, nowTime + opts.stunMs);
    p.stunnedReason = opts.stunnedReason || null;
  }
}

function spawnWaterSplash(x, strength = 1){
  if (!waterIsActive()) return;
  const sx = Math.max(10, Math.min(W - 10, x));
  const sy = waterLevelY;
  const count = 14 + Math.round(strength * 8);
  for (let i = 0; i < count; i++){
    const a = Math.random() * Math.PI - Math.PI / 2;
    const speed = (0.7 + Math.random() * 1.4) * strength;
    particles.push({
      x: sx,
      y: sy,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - (0.4 + Math.random() * 0.3),
      life: 30 + Math.random() * 12,
      smoke: false,
      water: true
    });
  }
  rings.push({ x: sx, y: sy, r: 6 + strength * 6, alpha: 0.5, water: true });
}

function startDrowning(idx){
  if (!waterIsActive()) return false;
  const p = players[idx];
  if (!p || p.hp <= 0 || p.drowning) return false;
  const nowTime = now();
  splash();
  spawnWaterSplash(p.x, 1.35);
  p.emote = '💦';
  p.emoteT = Math.round(DROWN_DURATION / 8);
  p.drowning = {
    start: nowTime,
    duration: DROWN_DURATION,
    lastSplash: nowTime
  };
  p.hp = 0;
  p.vx = 0;
  p.vy = 0;
  p.slideBoost = 0;
  clearRagdoll(p);
  p.turnLockedUntil = 0;
  p.stunnedReason = null;
  updateHPPlates();
  allowInput = false;
  fireBtn.disabled = true;
  placingTeleport = false;
  pauseTimer();
  resetAIState();
  shot = null;
  if (!pendingWinner){
    pendingWinner = {
      idx: 1 - idx,
      reason: 'drowned',
      triggerAt: nowTime + DROWN_DURATION + 150
    };
  }
  return true;
}

function checkWaterDeath(i){
  if (!waterIsActive()) return false;
  const p = players[i];
  if (!p || p.hp <= 0) return false;
  const feet = p.y + PLAYER_R;
  if (feet + 2 >= waterLevelY){
    return startDrowning(i);
  }
  return false;
}

function advanceFlood(){
  if (!waterFloodEnabled || !waterIsActive()) return;
  const next = Math.max(2, waterLevelY - waterFloodStep);
  if (next >= waterLevelY - 0.5) return;
  waterLevelY = next;
  spawnWaterSplash(players[0].x, 0.7);
  spawnWaterSplash(players[1].x, 0.7);
  checkWaterDeath(0);
  checkWaterDeath(1);
  drawMiniPreview();
}

function ensureWaterBelowPlayers(){
  if (!waterIsActive()) return;
  const margin = 24;
  let minAllowed = margin;
  for (const p of players){
    if (!p) continue;
    minAllowed = Math.max(minAllowed, p.y + PLAYER_R + margin);
  }
  if (waterLevelY < minAllowed){
    const clamped = Math.min(minAllowed, H);
    waterLevelY = clamped;
    waterBaseLevelY = Math.max(waterBaseLevelY, clamped);
  }
}

function drawWaterLayer(ctx){
  if (!waterIsActive()) return;
  const surface = waterLevelY;
  const amplitude = Math.max(6, H * 0.018);
  const step = 18;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, surface);
  for (let x = 0; x <= W; x += step){
    const wave = Math.sin(x * 0.04 + waterAnimT * 2.4) * amplitude * 0.4;
    ctx.lineTo(x, surface + wave);
  }
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, surface, 0, H);
  grad.addColorStop(0, 'rgba(80, 150, 255, 0.38)');
  grad.addColorStop(0.45, 'rgba(40, 90, 210, 0.32)');
  grad.addColorStop(1, 'rgba(16, 32, 72, 0.28)');
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
  ctx.restore();
}

// Turn timer
let turnTimerMs = 30000;     // menu-controlled; 0 means Off
let timeLeftMs = 30000;
let timerRunning = false;
let lastTick = 0;

// Camera
let cam = { scale: 1, targetScale: 1, min:0.85, max:1.8 };

// ========================
// = UI / HUD Management =
// ========================
function displayName(w){ return w==='normal' ? 'Bazooka' : (w.charAt(0).toUpperCase()+w.slice(1)); }

function updateWindUI(){
  const mag = Math.min(1, Math.abs(wind)/WIND_MAX || 0);
  windL.style.width = (wind<0 ? (mag*50).toFixed(1) : 0) + '%';
  windR.style.width = (wind>0 ? (mag*50).toFixed(1) : 0) + '%';
  const arrow = wind>0?'→ ': wind<0 ? '← ' : '· ';
  windVal.textContent = arrow + Math.round(mag*100);
}

function updateHPPlates(){
  const p1 = players[0], p2 = players[1];
  np1.textContent = `P1 — ${p1.hp}%`;
  np2.textContent = (aiEnabled? 'P2 (CPU) — ' : 'P2 — ') + `${p2.hp}%`;
}

function updateBadge(){
  const p = players[turn];
  weaponEmoji.textContent = EMOJI[weapon];
  weaponName.textContent = displayName(weapon);

  let meta = '';
  if (weapon==='grenade') meta += ` ⏱${p.fuse||5}s`;
  const am = p.ammo;
  const left = (weapon==='shotgun')?am.shotgun : weapon==='grenade'?am.grenade : weapon==='teleport'?am.teleport : Infinity;
  if (ammoChk.checked){
    if (left!==Infinity) meta += ` (${left>0?'x'+left:'empty'})`;
  } else {
    meta += ' (∞)';
  }
  weaponMeta.textContent = meta;

  fuseMini.textContent = `⏱${p.fuse||5}s`;
  pipNormal.textContent = ammoChk.checked ? '∞' : '∞';
  pipGrenade.textContent = ammoChk.checked ? ('x'+ am.grenade) : '∞';
  pipShotgun.textContent = ammoChk.checked ? ('x'+ am.shotgun) : '∞';
  pipTeleport.textContent = ammoChk.checked ? ('x'+ am.teleport) : '∞';

  refreshWeaponOptions();
  [...weaponMenu.querySelectorAll('.opt')].forEach(o=>o.classList.toggle('active', o.dataset.w===weapon));
}

function refreshWeaponOptions(){
  const p = players[turn];
  const optG = weaponMenu.querySelector('[data-w="grenade"]');
  const optS = weaponMenu.querySelector('[data-w="shotgun"]');
  const optT = weaponMenu.querySelector('[data-w="teleport"]');

  const gShow = (wGrenade.checked && (!ammoChk.checked || p.ammo.grenade>0));
  const sShow = (wShotgun.checked && (!ammoChk.checked || p.ammo.shotgun>0));
  const tShow = (wTeleport.checked && (!ammoChk.checked || p.ammo.teleport>0));

  if (optG) optG.style.display = gShow ? 'flex' : 'none';
  if (optS) optS.style.display = sShow ? 'flex' : 'none';
  if (optT) optT.style.display = tShow ? 'flex' : 'none';

  if ((weapon==='grenade' && !gShow) ||
      (weapon==='shotgun' && !sShow) ||
      (weapon==='teleport' && !tShow)){
    weapon = 'normal';
    players[turn].lastWeapon = weapon;
  }
}

function updateTurnUI(){
  turnEl.textContent = turn===0 ? 'P1' : (aiEnabled ? 'P2 (CPU 🤖)' : 'P2');
  if (turnTimerMs>0){
    timerChip.removeAttribute('aria-hidden');
    timerChip.style.display='inline-flex';
    timerVal.textContent = Math.ceil(timeLeftMs/1000) + 's';
  } else {
    timerChip.setAttribute('aria-hidden','true');
    timerChip.style.display='none';
  }
  updateBadge();
}

// Mini preview
function drawMiniPreview(){
  miniCtx.clearRect(0,0,mini.width,mini.height);
  miniCtx.fillStyle='#0b1020'; miniCtx.fillRect(0,0,mini.width,mini.height);
  if (waterIsActive()){
    const miniWaterY = Math.max(0, Math.min(mini.height, waterLevelY * (mini.height / H)));
    const grad = miniCtx.createLinearGradient(0, miniWaterY, 0, mini.height);
    grad.addColorStop(0, 'rgba(70,130,220,0.9)');
    grad.addColorStop(1, 'rgba(25,50,110,0.95)');
    miniCtx.fillStyle = grad;
    miniCtx.fillRect(0, miniWaterY, mini.width, mini.height - miniWaterY);
  }
  miniCtx.fillStyle='#18203a';
  for(let x=0;x<mini.width;x++){
    const wx = Math.floor(x * (W/mini.width));
    const hy = heightmap[wx] * (mini.height/H);
    miniCtx.fillRect(x, hy, 1, mini.height-hy);
  }
  miniCtx.fillStyle='#6ea8fe'; miniCtx.beginPath();
  miniCtx.arc(players[0].x * (mini.width/W), players[0].y * (mini.height/H), 3, 0, Math.PI*2); miniCtx.fill();
  miniCtx.fillStyle='#90c2ff'; miniCtx.beginPath();
  miniCtx.arc(players[1].x * (mini.width/W), players[1].y * (mini.height/H), 3, 0, Math.PI*2); miniCtx.fill();
  miniCtx.fillStyle='#fff'; miniCtx.font='10px system-ui';
  const mag = Math.min(1, Math.abs(wind)/WIND_MAX || 0);
  const arrow = wind>0?'→'+Math.round(mag*100): wind<0 ? '←'+Math.round(mag*100) : '· 0';
  miniCtx.fillText('Wind '+arrow, 6, 12);
}

function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {position:'absolute', left:'50%', top:'20%', transform:'translateX(-50%)',
    background:'rgba(18,25,50,.95)', color:'var(--ink)', border:'1px solid var(--line)',
    padding:'6px 10px', borderRadius:'10px', zIndex:70, fontSize:'13px'});
  stage.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 900);
}

// ================
// = Menu Logic   =
// ================
function openMenu(open){
  menuPanel.style.display = open ? 'block' : 'none';
  menuBtn.setAttribute('aria-expanded', open? 'true':'false');

  if (open && timerRunning) pauseTimer();
  if (!open && turnTimerMs>0 && allowInput) resumeTimer();

  if (open) {
    hideJoystick();      // always hide while menu is open
  } else {
    // menu just closed → reflect Movement option
    if (isTouch) {
      if (movementOn) showJoystick(); else hideJoystick();
    }
  }
}
menuBtn.addEventListener('click', ()=> openMenu(menuPanel.style.display!=='block'));
closeMenu.addEventListener('click', ()=> openMenu(false));
newMapBtn.addEventListener('click', ()=> pickNewSeedAndPreview());
startBtn.addEventListener('click', ()=>{
  mapSeed = (seedTxt.value.trim() || mapSeed || Math.random().toString(36).slice(2,8));
  resetGame(false);   // use current previewed map
  openMenu(false);
});
// Live-toggle movement + joystick from the menu
moveSel.addEventListener('change', () => {
// Re-read all menu settings so movementOn and timer reflect the UI
  readMenuSettings();

// If menu is currently open, we still show/hide the joystick immediately,
// so when you close the menu it's already correct.
  if (isTouch) {
    if (movementOn) showJoystick(); else hideJoystick();
  }
});

mini.addEventListener('pointerdown', onMiniLongPressStart);
['pointerup','pointerleave'].forEach(evt=>mini.addEventListener(evt, onMiniLongPressEnd));
let miniTimer=null;
function onMiniLongPressStart(){ miniTimer=setTimeout(()=>{
  const s = prompt('Enter custom seed (letters/numbers, up to 12):','');
  if (s){ srand(s); seedTxt.value=s; resetGame(true); }
}, 600); }
function onMiniLongPressEnd(){ clearTimeout(miniTimer); }

seedTxt.addEventListener('change', ()=>{ if (seedTxt.value.trim()){ srand(seedTxt.value.trim()); resetGame(true); } });

function readMenuSettings(){
  aiEnabled = (modeSel.value==='pvc');

  const wv = windSel.value;
  WIND_MAX = (wv==='Off'?0 : wv==='Low'?0.02 : wv==='Normal'?0.05 : 0.09);

  const desiredScale = bigMapChk.checked ? BIG_MAP_SCALE : 1;
  setWorldScale(desiredScale);
  bigMapOn = bigMapChk.checked;

  movementOn = (moveSel.value==='on');
  hillierTerrainOn = hillyChk.checked;
  varySpawnHeights = spawnVarChk.checked;
  scatterDebrisOn = chaosChk.checked;

  const tv = timerSel.value;
  turnTimerMs = (tv==='off') ? 0 : parseInt(tv,10)*1000;

  if (waterSel) {
    waterMode = waterSel.value || 'off';
  }
  if (waterFloodChk) {
    waterFloodEnabled = !!waterFloodChk.checked;
  } else {
    waterFloodEnabled = false;
  }
  if (waterFloodSel) {
    waterFloodSpeed = waterFloodSel.value || 'normal';
  }
  updateWaterConfig(false);
  updateFloodControls();
}

function updateFloodControls(){
  if (!waterFloodSel) return;
  const disabled = !waterFloodEnabled;
  waterFloodSel.disabled = disabled;
  waterFloodSel.parentElement?.classList?.toggle('disabled', disabled);
}

function pickNewSeedAndPreview(){
  mapSeed = Math.random().toString(36).slice(2,8);
  seedTxt.value = mapSeed;
  srand(mapSeed);
  readMenuSettings();
  updateWaterConfig(true);
  generateTerrain();
  updateAll();
  drawMiniPreview();
}

// ======================
// = Weapons & Firing   =
// ======================
function ensureAmmoOrSwitch(){
  const p=players[turn], am=p.ammo;
  if (ammoChk.checked){
    if (weapon==='shotgun' && am.shotgun<=0) weapon='normal';
    if (weapon==='grenade' && am.grenade<=0) weapon='normal';
    if (weapon==='teleport' && am.teleport<=0) weapon='normal';
  }
  players[turn].lastWeapon = weapon;
  updateBadge();
}
function spendAmmo(){
  if (!ammoChk.checked) return; // infinite
  const p=players[turn], am=p.ammo;
  if (weapon==='shotgun') am.shotgun = Math.max(0, am.shotgun - 1);
  if (weapon==='grenade') am.grenade = Math.max(0, am.grenade - 1);
  if (weapon==='teleport') am.teleport = Math.max(0, am.teleport - 1);

  if ((weapon==='shotgun' && am.shotgun===0) ||
      (weapon==='grenade' && am.grenade===0) ||
      (weapon==='teleport' && am.teleport===0)){
    toast(`${displayName(weapon)} out — switched to Bazooka`);
    weapon='normal'; players[turn].lastWeapon = weapon;
  }
  updateBadge();
}

function openWeaponMenu(open){
  weaponMenu.style.display = open ? 'flex' : 'none';
  weaponBadge.setAttribute('aria-expanded', open?'true':'false');
  if (!isTouch) return;
  if (open) {
    hideJoystick();
  } else if (movementOn) {
    showJoystick();
  }
}
weaponBadge.addEventListener('click', (e)=>{
  e.stopPropagation();
  if (placingTeleport || !allowInput) return;
  refreshWeaponOptions();
  openWeaponMenu(weaponMenu.style.display!=='flex');
});
document.addEventListener('click', ()=> openWeaponMenu(false));

weaponMenu.addEventListener('click', (e)=>{
  if (!(e.target instanceof HTMLElement)) return;
  const opt = e.target.closest('.opt'); if (!opt) return;
  const w = opt.dataset.w; if (!w) return;
  weapon = w;
  players[turn].lastWeapon = weapon;

  if (weapon==='teleport'){
    const am = players[turn].ammo.teleport;
    if (ammoChk.checked && am<=0){ toast('No teleport ammo'); weapon='normal'; players[turn].lastWeapon=weapon; }
    else { placingTeleport = true; fireBtn.disabled=true; toast('Teleport: tap the map to choose destination'); }
  } else { placingTeleport=false; fireBtn.disabled=false; }
  updateBadge();
  openWeaponMenu(false);
});

fuseMini.addEventListener('click',(e)=>{
  e.stopPropagation();
  const p=players[turn]; p.fuse = (p.fuse||5)%5 + 1; updateBadge();
});

// Fire/charge
let charging=false, chargePower=1, chargeInterval=null;
function startCharge(){
  if (!allowInput || shot || placingTeleport || charging) return;
  const current = players[turn];
  if (current && isRagdollActive(current)) return;
  if (weapon==='shotgun'){ launchShot(60); return; }
  charging=true; chargePower=1; startChargeSound(); chargeBar.style.width='0%';
  chargeInterval = setInterval(()=>{
    chargePower = Math.min(100, chargePower + 1.8);
    const pct = Math.max(0, Math.min(100, chargePower));
    chargeBar.style.width = pct + '%'; updateChargeSound(pct/100);
  },60);
}
function endChargeAndFire(){
  if (!charging) return; clearInterval(chargeInterval); chargeInterval=null;
  stopChargeSound(); charging=false; launchShot(chargePower); chargePower=1; chargeBar.style.width='0%';
}

fireBtn.addEventListener('mousedown', startCharge);
fireBtn.addEventListener('mouseup', endChargeAndFire);
fireBtn.addEventListener('mouseleave', endChargeAndFire);
fireBtn.addEventListener('touchstart', (e)=>{ e.preventDefault(); startCharge(); }, {passive:false});
fireBtn.addEventListener('touchend', (e)=>{ e.preventDefault(); endChargeAndFire(); }, {passive:false});
fireBtn.addEventListener('touchcancel', (e)=>{ e.preventDefault(); endChargeAndFire(); }, {passive:false});

function muzzleFrom(p, ang){
  return { x: p.x + Math.cos(ang)*(PLAYER_R+6), y: p.y - Math.sin(ang)*(PLAYER_R+6) };
}

function launchShot(power){
  // End your control immediately (turn will end after projectile resolves)
  lockInputsForShot();
  const p = players[turn]; stats.shots[turn]++;
  const ang = (p.angle*Math.PI)/180;
  const {x:muzzleX,y:muzzleY} = muzzleFrom(p, ang);
  const v = Math.max(1, power)*0.9;

  if (weapon==='normal'){
    const vx = Math.cos(ang)*v, vy = -Math.sin(ang)*v;
    shot = { kind:'normal', x:muzzleX, y:muzzleY, vx, vy, trail:[] };
    tone(320,0.06,'square',0.18);
    spendAmmo();
  } else if (weapon==='grenade'){
    const vx = Math.cos(ang)*v, vy = -Math.sin(ang)*v;
    const fuse = (players[turn].fuse||5);
    shot = { kind:'grenade', x:muzzleX, y:muzzleY, vx, vy, trail:[], t: fuse*60 };
    tone(260,0.06,'triangle',0.12);
    spendAmmo();
  } else if (weapon==='shotgun'){
    const pellets=[]; const spread = Math.PI/28; const n=7;
    for(let i=0;i<n;i++){
      const offset = (i-(n-1)/2)/(n-1) * spread;
      const a = ang + offset;
      const speed = v*(0.9+Math.random()*0.2);
      pellets.push({ x:muzzleX, y:muzzleY, vx:Math.cos(a)*speed, vy:-Math.sin(a)*speed, trail:[] });
    }
    shot = { kind:'shotgun', pellets, dealt:0 };
    tone(480,0.05,'square',0.12); setTimeout(()=>tone(420,0.05,'square',0.11),40); setTimeout(()=>tone(360,0.05,'square',0.1),80);
    spendAmmo();
  }
}

function lockInputsForShot(){
  allowInput = false;
  fireBtn.disabled = true;
  openWeaponMenu(false);
  pauseTimer(); // pause countdown during flight
}

function endShot(){
  shot=null;
  resetAIState();
  if (players[0].hp>0 && players[1].hp>0){
    // Switch turn
    turn = 1 - turn;
    cam.targetScale = Math.max(cam.min, Math.min(cam.max, cam.targetScale));
    cam.scale       = Math.max(cam.min, Math.min(cam.max, cam.scale));

    weapon = players[turn].lastWeapon || 'normal';
    updateTurnUI();
    wind = Math.max(-WIND_MAX, Math.min(WIND_MAX, wind + (Math.random()*0.06 - 0.03)));
    updateWindUI();
    advanceFlood();
    if (players[0].hp<=0 || players[1].hp<=0) return;
    players[turn].emote = ['😼','😹','😾','😺','😸'][Math.floor(Math.random()*5)];
    players[turn].emoteT = 80;
    ensureAmmoOrSwitch();

    // Prep next turn timer & inputs
    resetTurnTimer();

    const current = players[turn];
    if (current){
      if (current.turnLockedUntil && now() < current.turnLockedUntil){
        const emote = current.stunnedReason === 'winded' ? '😵' : '💫';
        current.emote = emote; current.emoteT = 80;
        toast(`P${turn+1} is recovering`);
        current.turnLockedUntil = 0;
        current.stunnedReason = null;
        setTimeout(()=> endShot(), 420);
        return;
      }
      current.stunnedReason = null;
    }

    const playerTurn = !aiEnabled || turn === 0;
    allowInput = playerTurn;
    fireBtn.disabled = playerTurn ? !!placingTeleport : true;

    if (aiEnabled && turn===1) setTimeout(aiPlay, 650);
  }
}

// ======================
// = Damage & Physics   =
// ======================
function floatDmg(x,y,val){ dmgNums.push({x,y,val,life:40}); }
function applyDamage(index, dmg, direct=false, opts = {}){
  const pl = players[index];
  pl.hp = Math.max(0, pl.hp - dmg);
  if (opts.impact){
    applyImpact(pl, opts.impact, opts);
  }
  updateHPPlates();
  if (pl.hp<=0){ announceWinner(1-index, direct ? 'direct hit!' : 'boom!'); }
}
function announceWinner(idx, reason){
  pendingWinner = null;
  fireBtn.disabled=true; placingTeleport=false;
  turnEl.textContent=`P${idx+1} wins 🎉`;
  players[idx].emote='😼✨'; players[idx].emoteT=120;
  players[1-idx].emote='💀'; players[1-idx].emoteT=120;
  taDa();
  showWinBanner(idx, reason);
}

function applySplashDamage(cx,cy,r, excludeIdx = -1){
  for(let i=0;i<players.length;i++){
    if (i === excludeIdx) continue;
    const pl=players[i]; const dx=pl.x-cx, dy=pl.y-cy;
    const d2=dx*dx+dy*dy, r2=r*r;
    if (d2<r2){
      const d=Math.sqrt(d2), scale=Math.max(0,1-d/r);
      const dmg=Math.round(scale*60);
      const nx = (pl.x - cx) / Math.max(1, d);
      const ny = (pl.y - cy) / Math.max(1, d);
      const impulse = {
        vx: nx * (5.4 * scale),
        vy: ny * (4.8 * scale) - 0.45
      };
      if (dmg>0){
        applyDamage(i,dmg,false, {
          impact: impulse,
          ragdollMs: RAGDOLL_MIN_MS + Math.round(220 * scale),
          slideBoost: 6 * scale
        });
        floatDmg(pl.x, pl.y-PLAYER_R-8, -dmg);
        stats.bestHit[turn]=Math.max(stats.bestHit[turn], dmg);
        stats.hits[turn]++;
      } else {
        applyImpact(pl, impulse, {
          ragdollMs: RAGDOLL_MIN_MS * 0.8,
          slideBoost: 3 * scale
        });
      }
    }
  }
}

function addFloatingBlob(cx, cy, r){
  const minx = Math.max(0, Math.floor(cx - r));
  const maxx = Math.min(W-1, Math.ceil(cx + r));
  const miny = Math.max(0, Math.floor(cy - r));
  const maxy = Math.min(H-1, Math.ceil(cy + r));
  if (minx>maxx || miny>maxy) return;

  const width = maxx - minx + 1;
  const height = maxy - miny + 1;
  const img = terrCtx.getImageData(minx, miny, width, height);
  const data = img.data;
  const rr = r*r;
  for(let y=miny;y<=maxy;y++){
    for(let x=minx;x<=maxx;x++){
      const dx = x - cx;
      const dy = y - cy;
      if (dx*dx + dy*dy <= rr){
        const idx = y*W + x;
        terrainMask[idx] = SOLID;
        const p = ((y-miny)*width + (x-minx)) * 4;
        data[p] = 36;
        data[p+1] = 44;
        data[p+2] = 72;
        data[p+3] = 255;
      }
    }
  }
  terrCtx.putImageData(img, minx, miny);

  for(let x=minx;x<=maxx;x++){
    let y;
    for(y=0;y<H;y++){
      if (terrainMask[y*W + x] === SOLID) break;
    }
    heightmap[x] = (y===H) ? H : y;
  }

  const g = decalCtx.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0,'rgba(210,174,110,0.25)');
  g.addColorStop(1,'rgba(100,86,52,0)');
  decalCtx.fillStyle = g;
  decalCtx.beginPath();
  decalCtx.arc(cx, cy, r, 0, Math.PI*2);
  decalCtx.fill();
}

function carveCrater(cx,cy,r=EXPLOSION_R){
  const minx=Math.max(0,Math.floor(cx-r)), maxx=Math.min(W-1,Math.ceil(cx+r));
  const miny=Math.max(0,Math.floor(cy-r)), maxy=Math.min(H-1,Math.ceil(cy+r));
  const img = terrCtx.getImageData(minx,miny,maxx-minx+1,maxy-miny+1);
  const d = img.data, rr=r*r;
  for(let y=miny;y<=maxy;y++){
    for(let x=minx;x<=maxx;x++){
      const dx=x-cx, dy=y-cy;
      if (dx*dx+dy*dy<=rr){
        const idx=y*W+x; terrainMask[idx]=SKY;
        const p=((y-miny)*(maxx-minx+1)+(x-minx))*4; d[p+3]=0;
      }
    }
  }
  terrCtx.putImageData(img,minx,miny);
  for(let x=minx;x<=maxx;x++){
    let y; for(y=0;y<H;y++){ if (terrainMask[y*W+x]===SOLID) break; }
    heightmap[x]=(y===H)?H:y;
  }
  const g=decalCtx.createRadialGradient(cx,cy,2,cx,cy,r);
  g.addColorStop(0,'rgba(0,0,0,0.28)'); g.addColorStop(1,'rgba(0,0,0,0)');
  decalCtx.fillStyle=g; decalCtx.beginPath(); decalCtx.arc(cx,cy,r,0,Math.PI*2); decalCtx.fill();
}

function computeShotPlan(me, target, weapon, angleStep, powerStep){
  let best = searchShotSolution(me, target, weapon, angleStep, powerStep);

  const last = aiMemory.lastSolution;
  if (last && last.weapon === weapon){
    const shift = Math.hypot((last.targetX||0) - target.x, (last.targetY||0) - target.y);
    if (shift < 120){
      const res = simulateHit(me, target, last.angle, last.power, weapon);
      if (isFinite(res.miss)){
        const seed = {
          miss: res.miss,
          angle: last.angle,
          power: last.power,
          flight: res.flight,
          score: res.miss,
        };
        const stepA = Math.max(2, Math.floor(angleStep/2));
        const stepP = Math.max(2, Math.floor(powerStep/2));
        const refineFromLast = refineShotSolution(me, target, weapon, seed, stepA, stepP);
        if (refineFromLast && (!best || refineFromLast.score < best.score)){
          best = refineFromLast;
        }
      }
    }
  }

  if (best && isFinite(best.miss)){
    const fineA = Math.max(2, Math.floor(angleStep/2));
    const fineP = Math.max(2, Math.floor(powerStep/2));
    const fine = refineShotSolution(me, target, weapon, best, fineA, fineP);
    if (fine && fine.score < best.score){
      best = fine;
    }
  }

  if (best && isFinite(best.miss)){
    best.weapon = weapon;
    best.targetX = target.x;
    best.targetY = target.y;
  }
  return best;
}

// ======================
// = Projectile Step    =
// ======================
function spawnExplosion(x,y,r=EXPLOSION_R, excludeIdx = -1){
  carveCrater(x,y,r);
  applySplashDamage(x,y,r, excludeIdx);
  const count = 28;
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2, sp = 1.5+Math.random()*3.5;
    const vx=Math.cos(a)*sp, vy=Math.sin(a)*sp-2.0;
    particles.push({x,y,vx,vy,life:50,smoke:false});
  }
  for(let i=0;i<16;i++){
    const a=(Math.random()*Math.PI) - Math.PI/2;
    const sp = .5+Math.random()*1.3;
    const vx=Math.cos(a)*sp*0.6, vy=Math.sin(a)*sp-0.8;
    particles.push({x,y,vx,vy,life:70,smoke:true, alpha:0.5});
  }
  rings.push({x,y,r:8,alpha:0.35});
  noiseBoom(0.35,0.35);
}

function stepShot(){
  if (!shot) return;

  if (shot.kind==='normal'){
    const s=shot;
    s.vx += wind; s.vy += G; s.x += s.vx; s.y += s.vy;
    s.trail.push({x:s.x,y:s.y}); if (s.trail.length>200) s.trail.shift();

    if (waterIsActive() && s.y >= waterLevelY){
      spawnWaterSplash(s.x, 0.6);
      splash();
      endShot({ water: true });
      return;
    }
    if (s.x<0 || s.x>=W || s.y>=H){ endShot(null); return; }

    const opp = players[1-turn];
    const dx=s.x-opp.x, dy=s.y-opp.y;
    if (dx*dx + dy*dy <= (PLAYER_R*PLAYER_R)*0.9){
      const dmg = 50;
      const impact = { vx: s.vx * 0.78, vy: s.vy * 0.55 - 0.4 };
      applyDamage(1-turn, dmg, true, {
        impact,
        ragdollMs: RAGDOLL_MIN_MS + 240,
        slideBoost: 5.2
      });
      floatDmg(opp.x, opp.y-PLAYER_R-8, -dmg);
      spawnExplosion(s.x,s.y,EXPLOSION_R, 1 - turn);
      endShot(opp); return;
    }
    const ix=s.x|0, iy=s.y|0;
    if (ix>=0 && ix<W && iy>=0 && iy<H && terrainMask[iy*W+ix]===SOLID){
      spawnExplosion(s.x,s.y,EXPLOSION_R); endShot({terrain:true}); return;
    }
  }

  if (shot.kind==='grenade'){
    const s=shot;
    s.vy += G; s.x += s.vx; s.y += s.vy; // wind ignored for grenades
    s.trail.push({x:s.x,y:s.y}); if (s.trail.length>140) s.trail.shift();
    s.t--; if (s.t<=0){ spawnExplosion(s.x,s.y,EXPLOSION_R*1.05); endShot({terrain:true}); return; }

    if (waterIsActive() && s.y >= waterLevelY){
      spawnWaterSplash(s.x, 0.8);
      splash();
      endShot({ water: true });
      return;
    }
    if (s.x<0 || s.x>=W || s.y>=H){ endShot(null); return; }

    // simple bounce
    const ix=s.x|0, iy=s.y|0;
    if (ix>=0 && ix<W && iy>=0 && iy<H && terrainMask[iy*W+ix]===SOLID){
      const gx = (heightmap[Math.min(W-1,ix+1)] - heightmap[Math.max(0,ix-1)])*0.5;
      let nx = -gx; let ny = 2;
      const len = Math.max(1, Math.hypot(nx,ny)); nx/=len; ny/=len;
      const dot = s.vx*nx + s.vy*ny;
      s.vx = (s.vx - 2*dot*nx) * 0.92;
      s.vy = (s.vy - 2*dot*ny) * 0.68;
      tone(180,0.04,'square',0.12);
      let c=0; while((terrainMask[(s.y|0)*W+(s.x|0)]===SOLID) && c++<6){ s.y-=1; }
    }
  }

  if (shot.kind==='shotgun'){
    const pellets = shot.pellets;
    let waterHit = false;
    let waterHitX = 0;
    for (let k=pellets.length-1;k>=0;k--){
      const p=pellets[k];
      p.vx += wind; p.vy += G; p.x += p.vx; p.y += p.vy;
      p.trail.push({x:p.x,y:p.y}); if (p.trail.length>80) p.trail.shift();
      if (waterIsActive() && p.y >= waterLevelY){
        waterHit = true;
        waterHitX = p.x;
        pellets.splice(k,1);
        continue;
      }
      if (p.x<0 || p.x>=W || p.y>=H){ pellets.splice(k,1); continue; }
      const ix=p.x|0, iy=p.y|0;
      const opp = players[1-turn];
      const dx=p.x-opp.x, dy=p.y-opp.y;
      if (dx*dx+dy*dy <= (PLAYER_R*PLAYER_R)*0.85){
        const perPellet = 16;
        const left = Math.max(0, 50 - (shot.dealt||0));
        const hit = Math.min(perPellet, left);
        if (hit > 0){
          const d=Math.max(1,Math.hypot(dx,dy));
          const pelletSpeed = Math.max(0.9, Math.hypot(p.vx, p.vy));
          const impact = {
            vx: (dx/d) * pelletSpeed * 0.55,
            vy: (dy/d) * pelletSpeed * 0.35 - 0.15
          };
          applyDamage(1-turn, hit, true, {
            impact,
            ragdollMs: SHOTGUN_RAGDOLL_MS,
            slideBoost: 3
          });
          floatDmg(opp.x, opp.y-PLAYER_R-8, -hit);
          shot.dealt = (shot.dealt||0) + hit;
        }
        pellets.splice(k,1);
        continue;
      }
      if (ix>=0 && ix<W && iy>=0 && iy<H && terrainMask[iy*W+ix]===SOLID){
        carveCrater(p.x,p.y,10);
        applySplashDamage(p.x,p.y,12, (shot.dealt||0) >= 50 ? (1 - turn) : -1);
        for(let i=0;i<6;i++){
          const a=Math.random()*Math.PI*2, sp=1+Math.random()*2.5;
          particles.push({x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1.2,life:28,smoke:false});
        }
        pellets.splice(k,1);
      }
    }
    if (waterHit){
      spawnWaterSplash(waterHitX, 0.5);
      splash();
    }
    if (pellets.length===0){
      if (!waterHit){
        noiseBoom(0.2,0.2);
      }
      endShot(waterHit ? { water: true } : { terrain: true });
    }
  }
}

// ===================
// = Teleport Place  =
// ===================
function screenToWorld(e){
  const rect=cvs.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W/rect.width);
  const py = (e.clientY - rect.top)  * (H/rect.height);
  return {px,py};
}

stage.addEventListener('pointerdown', (e)=>{
  if (!placingTeleport || !allowInput) return;
  const {px,py} = screenToWorld(e);
  const pos = findTeleportDestination(px,py);
  if (!pos){ toast('Blocked — choose a free spot'); tone(180,0.08,'sine',0.12); return; }
  if (ammoChk.checked) players[turn].ammo.teleport = Math.max(0, players[turn].ammo.teleport - 1);
  whoosh();
  players[turn].x = pos.x; players[turn].y = pos.y; players[turn].vx=0; players[turn].vy=0;
  poof();
  placingTeleport = false; fireBtn.disabled=false;
  updateBadge();
  // Teleport is a shot → end turn after effect
  lockInputsForShot();
  setTimeout(()=> endShot(), 200);
});

function findTeleportDestination(x,y){
  x = Math.max(PLAYER_R+2, Math.min(W-PLAYER_R-2, x|0));
  y = Math.max(PLAYER_R+2, Math.min(H-PLAYER_R-2, y|0));
  let yy=y; let tries=0;
  while(tries++<80 && terrainMask[(yy|0)*W+(x|0)]===SOLID){ yy--; }
  if (terrainMask[(yy|0)*W+(x|0)]===SOLID) return null;
  return {x, y:yy};
}

// =====================
// = Aiming & Zoom     =
// =====================
function normAngle(a){ a%=360; if (a<0) a+=360; return a; }
function getRelativeAngle(p){
  const base = p.facing===1 ? 0 : 180;
  const ang  = normAngle(p.angle);
  let delta  = (p.facing===1) ? (ang - base) : (base - ang);
  delta = ((delta + 540) % 360) - 180;
  return Math.max(-90, Math.min(90, delta));
}
function setRelativeAngle(p, delta){
  delta = Math.max(-90, Math.min(90, delta));
  const base = p.facing===1 ? 0 : 180;
  const ang  = (p.facing===1) ? (base + delta) : (base - delta);
  p.angle = normAngle(ang);
}

cvs.addEventListener('pointerdown', onAimPointer);
cvs.addEventListener('pointermove', onAimPointer);
function onAimPointer(e){
  if (shot || placingTeleport || !allowInput) return;
  const p = players[turn];
  if (p && isRagdollActive(p)) return;
  const rect=cvs.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W/rect.width);
  const py = (e.clientY - rect.top)  * (H/rect.height);
  let angRad = Math.atan2(p.y - py, px - p.x);
  let deg = angRad * 180/Math.PI;
  if (deg < 0) deg += 360;
  p.angle = Math.round(deg);
}

zoomIn.addEventListener('click', ()=>{ cam.targetScale=Math.min(cam.max, cam.targetScale+0.15); });
zoomOut.addEventListener('click', ()=>{ cam.targetScale=Math.max(cam.min, cam.targetScale-0.15); });
let lastTap=0;
cvs.addEventListener('pointerdown', (e)=>{
  const n=performance.now();
  if (n-lastTap<280 && Math.abs(e.movementX)<2 && Math.abs(e.movementY)<2){ cam.targetScale=1; }
  lastTap=n;
});

// =====================
// = Keyboard Control  =
// =====================
if (window.matchMedia('(pointer:fine)').matches) kbHelp.style.display = 'block';

function menuOpen(){ 
  return menuPanel.style.display==='block' || weaponMenu.style.display==='flex'; 
}

document.addEventListener('keydown', (e)=>{
  if (menuOpen()) return;
  // --- NEW: Space to start charging ---
  if (e.code === 'Space') {
    e.preventDefault();
    if (!shot && allowInput && !placingTeleport) startCharge();
    return;
  }

  // Weapons cycle
  if (e.key==='q' || e.key==='Q'){ e.preventDefault(); cycleWeapon(-1); return; }
  if (e.key==='e' || e.key==='E'){ e.preventDefault(); cycleWeapon(1);  return; }

  // Aiming
  if (e.code==='ArrowUp' || e.code==='ArrowDown'){
    if (movementOn && allowInput && e.code==='ArrowUp'){
      const left  = keys['ArrowLeft'] || keys['KeyA'];
      const right = keys['ArrowRight'] || keys['KeyD'];
      if (left || right){
        e.preventDefault();
        keys[e.code] = true;
        queueJump(turn, right ? +1 : -1);
        return;
      }
    }
    e.preventDefault();
    const step = e.shiftKey ? 5 : 2;
    const p = players[turn];
    let rel = getRelativeAngle(p);
    rel += (e.code==='ArrowUp' ? +step : -step);
    setRelativeAngle(p, rel);
    return;
  }

  // Prevent browser default for left/right when movement is enabled (some browsers still try to scroll)
  if (movementOn && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD')) {
  e.preventDefault();
  }

  // Movement / jumping (only if enabled & allowed & timer state)
  if (!movementOn || !allowInput) return;

  // Track pressed keys
  keys[e.code] = true;

  // diagonal jump only: (Left+Up) or (Right+Up)
  if ((e.code==='ArrowUp' || e.code==='KeyW')){
    const left  = keys['ArrowLeft'] || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    if (left || right){
      e.preventDefault();
      queueJump(turn, right? +1 : -1);
    }
  }
});

document.addEventListener('keyup', (e)=>{
  keys[e.code] = false; 
  
  // --- NEW: Space to release fire ---
  if (e.code === 'Space') {
    e.preventDefault();
    endChargeAndFire();
    return;
  }
});

function cycleWeapon(dir){
  const p = players[turn];
  const options = [
    {k:'normal', show:true},
    {k:'grenade', show: wGrenade.checked && (!ammoChk.checked || p.ammo.grenade>0)},
    {k:'shotgun', show: wShotgun.checked && (!ammoChk.checked || p.ammo.shotgun>0)},
    {k:'teleport', show: wTeleport.checked && (!ammoChk.checked || p.ammo.teleport>0)},
  ].filter(o=>o.show).map(o=>o.k);

  const i = Math.max(0, options.indexOf(weapon));
  const ni = (i + (dir>0?1:-1) + options.length) % options.length;
  weapon = options[ni] || 'normal';
  players[turn].lastWeapon = weapon;
  placingTeleport = (weapon==='teleport');
  fireBtn.disabled = placingTeleport || false;
  updateBadge();
}

// ==================
// = Joystick (Touch)
// ==================
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints>0;
if (isTouch) document.body.classList.add('is-touch');
let joyActive=false, joyCenter={x:0,y:0}, joyVec={x:0,y:0};
function showJoystick(){
  if (!movementOn || !isTouch || menuOpen()) return;
  joystick.classList.remove('hidden');
}
function hideJoystick(){ joystick.classList.add('hidden'); joyActive=false; joyVec={x:0,y:0}; resetStick(); }

function resetStick(){ stick.style.left='50%'; stick.style.top='50%'; }
resetStick();

joystick.addEventListener('touchstart', startJoy, {passive:false});
joystick.addEventListener('touchmove',  moveJoy,  {passive:false});
joystick.addEventListener('touchend',   endJoy,   {passive:false});
joystick.addEventListener('touchcancel',endJoy,   {passive:false});

function startJoy(e){
  if (!movementOn || !allowInput) return;
  e.preventDefault();
  const t = e.changedTouches[0];
  const r = joystick.getBoundingClientRect();
  joyCenter.x = r.left + r.width/2;
  joyCenter.y = r.top  + r.height/2;
  joyActive = true;
  moveJoy(e);
}

function moveJoy(e){
  if (!joyActive) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - joyCenter.x;
  const dy = t.clientY - joyCenter.y;
  const radius = Math.min(joystick.clientWidth, joystick.clientHeight)/2 - 8;
  const len = Math.hypot(dx,dy);
  const cl = Math.min(1, len/radius);
  const nx = (len>0? dx/len : 0) * cl;
  const ny = (len>0? dy/len : 0) * cl;

  joyVec.x = nx; joyVec.y = ny;

  stick.style.left = (50 + nx*45) + '%';
  stick.style.top  = (50 + ny*45) + '%';

  // If pushing up, attempt a hop (vertical or diagonal) with buffer/coyote
  if (allowInput && movementOn){
    const dir = Math.abs(nx) > 0.25 ? Math.sign(nx) : 0; // left/right
    const up  = (-ny) > 0.45;
    if (up){
      queueJump(turn, dir);
    }
  }
}

function endJoy(){
  joyActive=false; joyVec={x:0,y:0}; resetStick();
}

// =========================
// = Movement & Jumping    =
// =========================
const FALL_NO_DMG = 60;

function setMoveForTurnPlayer(){
  const p = players[turn];

  if (p && p.drowning){
    p.vx *= 0.9;
    return;
  }

  if (aiEnabled && turn === 1) {
    const task = aiState.moveTask;
    if (task) {
      if (!movementOn) {
        aiState.moveTask = null;
        if (!shot) {
          executeAIShot(task.fallbackDecision || task.decision);
        }
      } else {
        const dx = task.targetX - p.x;
        const dir = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const absDx = Math.abs(dx);
        const tolerance = task.tolerance || 4;

        if (absDx <= tolerance) {
          // close enough: bleed off horizontal speed
          if (Math.abs(p.vx) > 0.25) {
            p.vx *= 0.6;
          } else {
            p.vx = 0;
          }
        } else {
          const desired = dir * Math.min(MOVE.max * 0.9, 0.4 + absDx * 0.015);
          if (Math.abs(desired - p.vx) > MOVE.accel) {
            p.vx += MOVE.accel * (desired > p.vx ? 1 : -1);
          } else {
            p.vx = desired;
          }
          p.facing = dir === 0 ? p.facing : dir;
        }
      }
      return;
    }
  }

  // called during step based on keys/joystick for human players (and AI when not moving)
  if (!movementOn || !allowInput) return;

  const left  = keys['ArrowLeft'] || keys['KeyA'] || (isTouch && joyVec.x < -0.2);
  const right = keys['ArrowRight']|| keys['KeyD'] || (isTouch && joyVec.x >  0.2);

  if (left){ p.vx = Math.max(-MOVE.max, p.vx - MOVE.accel); p.facing = -1; }
  else if (right){ p.vx = Math.min(MOVE.max, p.vx + MOVE.accel); p.facing = +1; }
}

function isGrounded(p){
  const under = terrainMask[Math.min(H-1,(p.y+PLAYER_R+1|0))*W + (p.x|0)];
  return under===SOLID;
}

function queueJump(i, dir){
  // dir: -1 left, 0 up, +1 right
  const t = now();
  lastJumpPressedAt[i] = t;

  const p = players[i];
  const grounded = isGrounded(p);
  const sinceGround = t - lastGroundedAt[i];
  const sinceJump   = t - lastJumpAt[i];

  if (!grounded && sinceGround > MOVE.coyoteMs) return;
  if (sinceJump < MOVE.jumpCooldown) return;

  // execute jump
  p.vy = MOVE.jumpVy;
  if (dir!==0){ p.vx += dir * MOVE.hopBoost; }
  lastJumpAt[i] = t;
  // tiny sparkle
  for(let k=0;k<8;k++){
    const a = Math.random()*Math.PI - Math.PI/2;
    particles.push({x:p.x, y:p.y+PLAYER_R-2, vx:Math.cos(a)*1.2, vy:Math.sin(a)*1.2-0.6, life:26, smoke:false});
  }
}

// ======================
// = Players Step/Draw  =
// ======================
function stepPlayers(){
  for (let i=0;i<2;i++){
    const p=players[i];

    if (p.ragdoll && now() >= p.ragdoll.until) {
      p.ragdoll = null;
    }

    if (p.slideBoost) {
      p.slideBoost *= SLIDE_DECAY;
      if (p.slideBoost < 0.08) p.slideBoost = 0;
    }

    const ragActive = isRagdollActive(p);

    if (p.drowning){
      p.vx *= 0.92;
      p.vy = 0;
      p.y = Math.min(p.y, waterLevelY - PLAYER_R - 1.5);
      continue;
    }

    // Apply movement input for current turn player
    if (!ragActive && i===turn) setMoveForTurnPlayer();

    let onSolid = isGrounded(p);
    if (p.vy < 0) onSolid = false; // let jump impulse lift the cat off the ground

    if (!onSolid){
      p.vy += G;
      p.y += p.vy;
      p.x += p.vx;
      if (ragActive && p.ragdoll){
        p.vx *= p.ragdoll.airDrag || 0.985;
      }

      if (p.vy < 0){
        let headHit = false;
        const offsets = [0, -PLAYER_R*0.55, PLAYER_R*0.55];
        const headY = p.y - PLAYER_R - 1;
        for (let k=0;k<offsets.length;k++){
          if (isSolidAt(p.x + offsets[k], headY)){
            headHit = true; break;
          }
        }
        if (headHit){
          let iterations = 0;
          do {
            p.y += 0.5;
            iterations++;
            const newHead = p.y - PLAYER_R - 1;
            headHit = offsets.some(off => isSolidAt(p.x + off, newHead));
          } while(headHit && iterations < PLAYER_R*2);
          p.vy = 0;
        }
      }

      const gy = groundYAt(p.x, p.y + PLAYER_R);
      if (gy < H && p.y + PLAYER_R > gy){
        const over = p.y + PLAYER_R - gy;
        const prevVy = p.vy;
        p.y = gy - PLAYER_R;
        p.vy = 0;
        if (ragActive){
          p.vx *= 0.82;
        } else {
          p.vx *= 0.45;
        }

        // landing puff
        if (Math.abs(prevVy) > 1.2){
          for(let k=0;k<6;k++){
            const a=Math.random()*Math.PI, sp=1+Math.random()*1.4;
            particles.push({x:p.x,y:p.y+PLAYER_R,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.4,life:24,smoke:true,alpha:.5});
          }
        }

        const drop = Math.abs(prevVy*8 + over);
        if (fallChk.checked){
          if (drop>FALL_NO_DMG){
            const dmg = Math.min(25, Math.round((drop - FALL_NO_DMG)/6));
            if (dmg>0){
              const impact = { vx: p.vx * 0.4, vy: -Math.abs(prevVy) * 0.3 };
              applyDamage(i, dmg, false, {
                impact,
                ragdollMs: RAGDOLL_MIN_MS * 0.9,
                slideBoost: Math.min(7, drop * 0.02),
                stunMs: FALL_STUN_DURATION,
                stunnedReason: 'winded'
              });
              floatDmg(p.x, p.y-PLAYER_R-8, -dmg);
              if (i===turn && allowInput){
                allowInput = false;
                fireBtn.disabled = true;
                setTimeout(() => endShot(), 320);
              }
            }
          }
        }
        if (drop > FALL_STUN_THRESHOLD * 0.6){
          p.slideBoost = Math.min(SLIDE_BONUS_MAX, Math.max(p.slideBoost, drop * 0.015));
        }
        lastGroundedAt[i] = now();
      }
    } else {
      // --- ON GROUND: apply horizontal motion, slope settle, then friction ---

      const gy = groundYAt(p.x, p.y + PLAYER_R + 1);
      if (gy < H) { p.y = gy - PLAYER_R; }

      const xl = Math.max(0, p.x-2|0), xr=Math.min(W-1, p.x+2|0);
      const sl = groundYAt(xl, p.y + PLAYER_R);
      const sr = groundYAt(xr, p.y + PLAYER_R);
      let slope = 0;
      if (sl < H && sr < H){
        slope = (sr - sl) / 4;
        if (Math.abs(slope) > 0.5) { p.x += slope * 0.25; }
      }

      // Move horizontally while grounded
      p.x += p.vx;
      const gyAfter = groundYAt(p.x, p.y + PLAYER_R + 1);
      if (gyAfter < H && p.y + PLAYER_R > gyAfter){
        p.y = gyAfter - PLAYER_R;
      }

      // Ground friction & zero vertical velocity
      let groundFriction = MOVE.friction;
      if (Math.abs(slope) < 0.4){
        groundFriction = Math.min(0.985, MOVE.friction + 0.02);
      } else if (Math.abs(slope) < 0.9) {
        groundFriction = Math.max(0.9, MOVE.friction - 0.05);
      } else {
        groundFriction = Math.max(0.82, MOVE.friction - 0.12);
      }
      if (p.slideBoost){
        groundFriction = Math.max(0.58, groundFriction - 0.28);
      }
      if (ragActive){
        groundFriction = Math.min(groundFriction, 0.8);
      }
      p.vx *= groundFriction;
      p.vy = 0;

      if (ragActive && Math.abs(p.vx) < 0.24){
        clearRagdoll(p);
      }

      // Remember last time we were grounded (for coyote-time jumps)
      lastGroundedAt[i] = now();
    }

    // Bounds
    p.x = Math.max(PLAYER_R, Math.min(W-PLAYER_R, p.x));
    p.y = Math.max(PLAYER_R, Math.min(H-PLAYER_R, p.y));

    if (waterIsActive()) {
      checkWaterDeath(i);
    }
  }
}

// ======================
// = AI helpers & logic =
// ======================
function randomRange(min, max){
  return min + Math.random() * (max - min);
}

function clampShotAngle(angle){
  return ((angle % 360) + 360) % 360;
}

function clampShotPower(power){
  return Math.max(20, Math.min(100, power));
}

function isPlanViable(plan){
  return !!plan && Number.isFinite(plan.miss) && plan.angle !== undefined && plan.power !== undefined;
}

function clonePlan(plan){
  return plan ? { ...plan } : null;
}

function computeFuseFromPlan(plan){
  if (!plan || !plan.flight) return 3;
  return Math.max(1, Math.min(5, Math.round(plan.flight / 60)));
}

function scoreShotPlan(plan){
  return isPlanViable(plan) ? plan.miss : Infinity;
}

function isWalkableRange(startX, endX, maxRise = 44){
  if (startX === endX) return true;
  const dir = startX < endX ? 1 : -1;
  const step = 12 * dir;
  let prev = groundYAt(startX);
  if (prev >= H) return false;
  for (let x = startX + step; dir > 0 ? x <= endX : x >= endX; x += step){
    const gy = groundYAt(x);
    if (gy >= H) return false;
    if (Math.abs(gy - prev) > maxRise) return false;
    prev = gy;
  }
  const end = groundYAt(endX);
  return end < H;
}

function createDecisionFromPlan(plan, overrides = {}){
  const copy = clonePlan(plan);
  if (!copy) return null;
  const decision = {
    plan: copy,
    jitter: overrides.jitter ?? null,
    remember: overrides.remember ?? false,
    fireDelay: overrides.fireDelay ?? (copy.weapon === Weapons.SHOTGUN ? 160 : 240)
  };
  if (copy.weapon === Weapons.GRENADE){
    copy.fuse = overrides.fuse ?? computeFuseFromPlan(copy);
  }
  return decision;
}

function makeFallbackDecision(me, you){
  const dx = you.x - me.x;
  const dy = me.y - you.y;
  let direct = Math.atan2(dy, dx);
  if (direct < 0) direct += Math.PI * 2;
  const angle = clampShotAngle((direct * 180) / Math.PI);
  const dist = Math.hypot(dx, dy);
  const power = clampShotPower(dist * 0.24 + 30);
  return {
    plan: {
      weapon: Weapons.NORMAL,
      angle,
      power,
      miss: Infinity
    },
    jitter: { angle: randomRange(-10, 10), power: randomRange(-14, 14) },
    remember: false,
    fireDelay: 240
  };
}

function findHardMovement(me, you, currentPlan){
  if (!movementOn || !isPlanViable(currentPlan)) return null;
  const baseBlocked = terrainBlocksDirectShot(me, you);
  const waterActive = waterIsActive();
  const baseFeet = (currentPlan.originY !== undefined ? currentPlan.originY : me.y) + PLAYER_R;
  const basePenalty = waterPenaltyForFeet(baseFeet);
  let baseScore = scoreShotPlan(currentPlan) + basePenalty + (baseBlocked ? 60 : 0);
  const offsets = [48, -48, 96, -96, 144, -144];
  let best = null;

  for (const offset of offsets){
    const targetX = Math.max(PLAYER_R, Math.min(W - PLAYER_R, me.x + offset));
    if (Math.abs(targetX - me.x) < 6) continue;
    if (!isWalkableRange(me.x, targetX)) continue;
    const ground = groundYAt(targetX);
    if (ground >= H) continue;
    const targetY = ground - PLAYER_R;
    if (targetY < PLAYER_R || targetY >= H) continue;
    if (Math.abs(targetY - me.y) > 115) continue;
    if (waterActive && targetY + PLAYER_R >= waterLevelY - 4) continue;

    const probe = { ...me, x: targetX, y: targetY };
    const plan = computeShotPlan(probe, you, Weapons.NORMAL, 4, 4);
    if (!isPlanViable(plan)) continue;
    plan.weapon = Weapons.NORMAL;
    plan.originX = targetX;
    plan.originY = targetY;

    const travel = Math.abs(targetX - me.x);
    const travelPenalty = travel * 0.28;
    const blocked = terrainBlocksDirectShot(probe, you);
    const feet = targetY + PLAYER_R;
    const waterPenalty = waterPenaltyForFeet(feet);
    let score = plan.miss + travelPenalty + waterPenalty + (blocked ? 120 : 0);
    if (baseBlocked && !blocked) score -= 45;
    if (waterActive && waterPenalty <= 0) score -= 12;

    if (!best || score < best.score){
      best = {
        score,
        plan: clonePlan(plan),
        targetX,
        targetY,
        blocked,
        feet
      };
    }
  }

  if (!best) return null;
  const improvement = baseScore - best.score;
  const baseUnsafe = waterActive && baseFeet >= waterLevelY - 6;
  const candidateSafe = waterActive && best.feet + 8 < waterLevelY;
  const shouldMove =
    (baseUnsafe ? candidateSafe : false) ||
    (!baseUnsafe && (!Number.isFinite(baseScore) ||
    baseScore > 80 ||
    improvement > 8 ||
    (best.blocked === false && baseBlocked)));

  if (!shouldMove) return null;

  return {
    targetX: best.targetX,
    tolerance: 4,
    settleMs: 220,
    decisionPlan: best.plan,
    fallbackPlan: clonePlan(currentPlan)
  };
}

function planEasyTurn(me, you){
  const basePlan = computeShotPlan(me, you, Weapons.NORMAL, 14, 12);
  const chosen = isPlanViable(basePlan) && basePlan.miss < 480 ? basePlan : {
    weapon: Weapons.NORMAL,
    angle: clampShotAngle(20 + Math.random() * 320),
    power: clampShotPower(30 + Math.random() * 55),
    miss: Infinity
  };

  const decision = createDecisionFromPlan(chosen, {
    jitter: { angle: randomRange(-14, 14), power: randomRange(-22, 22) },
    remember: false,
    fireDelay: 320 + Math.random() * 260
  });

  return { decision, move: null };
}

function planMediumTurn(me, you){
  const canGrenade = wGrenade.checked && (!ammoChk.checked || me.ammo.grenade > 0);
  const coarseStep = 7;
  const powerStep = 6;

  const normalPlan = computeShotPlan(me, you, Weapons.NORMAL, coarseStep, powerStep);
  let chosenPlan = normalPlan;

  if (canGrenade){
    const grenadePlan = computeShotPlan(me, you, Weapons.GRENADE, coarseStep + 1, powerStep + 1);
    if (isPlanViable(grenadePlan)){
      const normalMiss = scoreShotPlan(normalPlan);
      const grenadeMiss = scoreShotPlan(grenadePlan);
      if ((grenadeMiss + 25 < normalMiss && grenadeMiss < 220) || !Number.isFinite(normalMiss)){
        chosenPlan = grenadePlan;
      }
    }
  }

  if (!isPlanViable(chosenPlan)){
    return { decision: makeFallbackDecision(me, you), move: null };
  }

  const decision = createDecisionFromPlan(chosenPlan, {
    jitter: { angle: randomRange(-3.2, 3.2), power: randomRange(-7, 7) },
    remember: false,
    fireDelay: 250 + Math.random() * 180
  });

  return { decision, move: null };
}

function planHardTurn(me, you){
  const dx = you.x - me.x;
  const dy = me.y - you.y;
  const dist = Math.hypot(dx, dy);
  const heightDiff = Math.abs(dy);
  const canShotgun = wShotgun.checked && (!ammoChk.checked || me.ammo.shotgun > 0);
  const wantsShotgun = canShotgun && dist < 150 && heightDiff < 70;

  const bazookaPlan = computeShotPlan(me, you, Weapons.NORMAL, 4, 4);
  let chosenPlan = bazookaPlan;
  let moveOption = null;

  if (wantsShotgun){
    const shotgunPlan = computeShotPlan(me, you, Weapons.SHOTGUN, 6, 5);
    if (isPlanViable(shotgunPlan) && shotgunPlan.miss < 70){
      chosenPlan = shotgunPlan;
    }
  }

  if (!isPlanViable(chosenPlan)){
    chosenPlan = computeShotPlan(me, you, Weapons.NORMAL, 6, 5) || bazookaPlan;
  }

  if (!isPlanViable(chosenPlan)){
    return { decision: makeFallbackDecision(me, you), move: null };
  }

  chosenPlan.originX = me.x;
  chosenPlan.originY = me.y;

  if (chosenPlan.weapon === Weapons.NORMAL){
    moveOption = findHardMovement(me, you, chosenPlan);
    if (moveOption){
      chosenPlan = moveOption.decisionPlan;
    }
  }

  const decision = createDecisionFromPlan(chosenPlan, {
    jitter: null,
    remember: chosenPlan.weapon === Weapons.NORMAL,
    fireDelay: chosenPlan.weapon === Weapons.SHOTGUN ? 160 : 200
  });

  return { decision, move: moveOption };
}

function beginAIMove(decision, move){
  if (!move){
    executeAIShot(decision);
    return;
  }
  aiState.moveTask = {
    targetX: Math.max(PLAYER_R, Math.min(W - PLAYER_R, move.targetX)),
    tolerance: move.tolerance ?? 4,
    settleMs: move.settleMs ?? 200,
    start: now(),
    maxDuration: 2200,
    settleAt: null,
    decision,
    fallbackDecision: move.fallbackPlan
      ? createDecisionFromPlan(move.fallbackPlan, {
          jitter: null,
          remember: move.fallbackPlan.weapon === Weapons.NORMAL,
          fireDelay: decision.fireDelay
        })
      : decision,
    lastX: players[1].x,
    noProgressSince: now()
  };
}

function executeAIShot(decision){
  if (!decision || !decision.plan) return;
  const me = players[1];
  const plan = decision.plan;
  aiState.moveTask = null;
  aiState.pendingPlan = null;

  let angle = plan.angle;
  let power = plan.power;
  if (decision.jitter){
    angle += decision.jitter.angle || 0;
    power += decision.jitter.power || 0;
  }

  angle = clampShotAngle(angle);
  power = clampShotPower(power);

  const choice = plan.weapon || Weapons.NORMAL;
  weapon = choice;
  me.lastWeapon = choice;
  me.angle = Math.round(angle);
  me.lastPower = power;

  if (choice === Weapons.GRENADE){
    me.fuse = plan.fuse ?? computeFuseFromPlan(plan);
  }

  updateBadge();

  const delay = decision.fireDelay ?? 220;
  setTimeout(() => {
    if (!shot && turn === 1) {
      launchShot(power);
    }
  }, delay);

  if (decision.remember){
    aiMemory.lastSolution = {
      weapon: choice,
      angle: plan.angle,
      power: plan.power,
      miss: plan.miss,
      score: plan.score,
      flight: plan.flight,
      targetX: plan.targetX,
      targetY: plan.targetY
    };
  } else {
    aiMemory.lastSolution = null;
  }
}

function processAIState(){
  if (!aiEnabled || turn !== 1 || shot) return;
  const task = aiState.moveTask;
  if (!task) return;

  const me = players[1];
  const currentTime = now();
  const dx = task.targetX - me.x;
  const absDx = Math.abs(dx);

  if (absDx <= task.tolerance && Math.abs(me.vx) < 0.35){
    if (!task.settleAt){
      task.settleAt = currentTime;
    }
    if (currentTime - task.settleAt >= task.settleMs){
      const decision = task.decision;
      aiState.moveTask = null;
      executeAIShot(decision);
      return;
    }
  } else {
    task.settleAt = null;
  }

  if (Math.abs(me.x - task.lastX) > 3){
    task.lastX = me.x;
    task.noProgressSince = currentTime;
  } else if (currentTime - task.noProgressSince > 700){
    const fallback = task.fallbackDecision || task.decision;
    aiState.moveTask = null;
    executeAIShot(fallback);
    return;
  }

  if (currentTime - task.start > task.maxDuration){
    const fallback = task.fallbackDecision || task.decision;
    aiState.moveTask = null;
    executeAIShot(fallback);
  }
}

function aiPlay(){
  if (!aiEnabled || turn !== 1 || shot) return;
  resetAIState();
  const me = players[1];
  const you = players[0];
  const diff = diffSel.value;

  let payload;
  if (diff === 'Easy') payload = planEasyTurn(me, you);
  else if (diff === 'Medium') payload = planMediumTurn(me, you);
  else payload = planHardTurn(me, you);

  let decision = payload?.decision;
  let move = payload?.move || null;

  if (!decision){
    decision = makeFallbackDecision(me, you);
    move = null;
  }

  beginAIMove(decision, move);
}

function terrainBlocksDirectShot(from, to){
  const left = Math.floor(Math.min(from.x, to.x));
  const right = Math.ceil(Math.max(from.x, to.x));
  if (right - left < 12) return false;
  const dx = to.x - from.x;
  if (Math.abs(dx) < 1) return false;
  const slope = (to.y - from.y) / dx;
  const step = Math.max(1, Math.floor((right - left) / 48));
  for (let ix = left + 6; ix <= right - 6; ix += step){
    const lineY = from.y + slope * (ix - from.x);
    const groundY = heightmap[Math.max(0, Math.min(W-1, ix))];
    if (groundY < lineY - 10){
      return true;
    }
  }
  return false;
}

function simulateHit(me, target, angDeg, power, kind){
  const ang = angDeg * Math.PI / 180;
  let x = me.x + Math.cos(ang)*(PLAYER_R+6);
  let y = me.y - Math.sin(ang)*(PLAYER_R+6);
  let vx = Math.cos(ang)*Math.max(1,power)*0.9;
  let vy = -Math.sin(ang)*Math.max(1,power)*0.9;
  let bestDist = Infinity;
  let impactX = x, impactY = y;
  let flight = 0;

  for (let t=0; t<420; t++){
    if (kind==='grenade') vy += G;
    else { vx += wind; vy += G; }
    x += vx; y += vy;
    flight = t+1;

    if (x<0 || x>=W || y>=H) break;

    const distToTarget = Math.hypot(x-target.x, y-target.y);
    if (distToTarget < bestDist){
      bestDist = distToTarget;
      impactX = x; impactY = y;
    }

    if (distToTarget <= PLAYER_R*0.9){
      return {miss:0, flight, impactX:x, impactY:y};
    }

    const ix = x|0, iy = y|0;
    if (ix>=0 && ix<W && iy>=0 && iy<H && terrainMask[iy*W+ix]===SOLID){
      break;
    }
  }

  return {miss:bestDist, flight, impactX, impactY};
}

function searchShotSolution(me, target, weapon, angleStep, powerStep){
  let best = {miss:1e12, angle:45, power:60, flight:60, score:1e12};
  const minAngle = 8, maxAngle = 172;
  const minPower = weapon==='shotgun' ? 35 : 24;
  const maxPower = 100;
  for (let ang = minAngle; ang<=maxAngle; ang+=angleStep){
    for (let pow = minPower; pow<=maxPower; pow+=powerStep){
      const res = simulateHit(me, target, ang, pow, weapon);
      const penalty = (weapon==='shotgun' ? pow*0.4 : pow*0.1);
      const score = res.miss + penalty*0.01;
      if (score < best.score){
        best = {...res, angle:ang, power:pow, score};
      }
    }
  }
  return best;
}

function refineShotSolution(me, target, weapon, seed, angleStep, powerStep){
  if (!seed || !isFinite(seed.miss)) return seed;
  let best = {...seed};
  for (let ang = seed.angle - angleStep*4; ang <= seed.angle + angleStep*4; ang += angleStep){
    if (ang<6 || ang>174) continue;
    for (let pow = seed.power - powerStep*5; pow <= seed.power + powerStep*5; pow += powerStep){
      if (pow<20 || pow>100) continue;
      const res = simulateHit(me, target, ang, pow, weapon);
      const penalty = (weapon==='shotgun' ? pow*0.4 : pow*0.1);
      const score = res.miss + penalty*0.01;
      if (score < best.score){
        best = {...res, angle:ang, power:pow, score};
      }
    }
  }
  return best;
}

// =====================
// = Wind & Turn Timer =
// =====================
function randomizeWind(){ readMenuSettings(); wind = (Math.random()*2-1)*WIND_MAX; updateWindUI(); }

function resetTurnTimer(){
  timeLeftMs = turnTimerMs;
  lastTick = performance.now();
  if (turnTimerMs>0){ timerRunning = true; }
  else { timerRunning = false; }
  updateTurnUI();
}
function pauseTimer(){ timerRunning=false; }
function resumeTimer(){ if (turnTimerMs>0){ lastTick = performance.now(); timerRunning=true; } }

function onTimerFrame(){
  if (!timerRunning || !allowInput) return;
  const n = performance.now();
  const dt = n - lastTick; lastTick = n;
  timeLeftMs = Math.max(0, timeLeftMs - dt);
  timerVal.textContent = Math.ceil(timeLeftMs/1000) + 's';
  if (timeLeftMs<=0){
    // Forfeit shot; end turn
    allowInput = false;
    fireBtn.disabled = true;
    openWeaponMenu(false);
    setTimeout(endShot, 200);
  }
}

// ==================
// = Render & FX    =
// ==================
function showWinBanner(idx, reason){
  const sh = stats.shots[idx], hi = stats.hits[idx];
  const acc = sh? Math.round(100*hi/sh):0;
  const big = stats.bestHit[idx]||0;
  winTxt.textContent = `P${idx+1} wins 🎉 (${reason})`;
  statsTxt.textContent = `Shots: ${sh} · Accuracy: ${acc}% · Biggest hit: ${big}`;
  banner.style.display='flex';
  pauseTimer();
}
rematchBtn.addEventListener('click', ()=>{ banner.style.display='none'; resetGame(false); });
newMapBannerBtn.addEventListener('click', ()=>{
  banner.style.display='none';
  pickNewSeedAndPreview();
  resetGame(false);
});
openMenuBtn.addEventListener('click', ()=>{ banner.style.display='none'; openMenu(true); });

function draw(){
  requestAnimationFrame(draw);

  // Timer
  onTimerFrame();

  // Smooth cam
  cam.scale += (cam.targetScale - cam.scale)*0.15;
  waterAnimT += 0.013;
  const frameNow = now();

  ctx.save();
  ctx.clearRect(0,0,W,H);
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0b1020'); g.addColorStop(1,'#0e1430');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.translate(W/2, H/2); ctx.scale(cam.scale, cam.scale); ctx.translate(-W/2, -H/2);

  ctx.drawImage(terrCanvas,0,0);
  ctx.drawImage(decalCanvas,0,0);
  drawWaterLayer(ctx);

  // Players
  players.forEach((p,idx)=>{
    const drown = p.drowning;
    const ragActive = !drown && isRagdollActive(p);
    let drawY = p.y;
    let drawAlpha = 1;
    if (drown){
      const elapsed = frameNow - drown.start;
      const t = Math.min(1, elapsed / drown.duration);
      const sink = t * (PLAYER_R + 28);
      const bob = Math.sin(t * Math.PI * 4) * (1 - t) * 3;
      drawY = Math.min(p.y + sink + bob, waterLevelY + PLAYER_R + 6);
      drawAlpha = Math.max(0.08, 1 - t * 0.92);
      if (frameNow - drown.lastSplash > 200 && t < 0.85){
        spawnWaterSplash(p.x + (Math.random() - 0.5) * 16, 0.26);
        drown.lastSplash = frameNow;
      }
    } else if (ragActive && p.ragdoll){
      if (!p.ragdoll.lastSpray || frameNow - p.ragdoll.lastSpray > 140){
        spawnWaterSplash(p.x + (Math.random() - 0.5) * 18, 0.16);
        p.ragdoll.lastSpray = frameNow;
      }
    }

    const shadowAlpha = drawAlpha * 0.28;
    const shadowY = drown ? Math.min(waterLevelY + 4, drawY + PLAYER_R - 2) : drawY + PLAYER_R - 2;
    ctx.fillStyle=`rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath(); ctx.ellipse(p.x, shadowY, PLAYER_R*0.8, 5, 0,0,Math.PI*2); ctx.fill();

    ctx.save();
    ctx.globalAlpha = drawAlpha;
    ctx.fillStyle = idx===0 ? '#6ea8fe' : '#90c2ff';
    ctx.beginPath(); ctx.arc(p.x,drawY,PLAYER_R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.stroke();

    ctx.font='18px system-ui,emoji'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.emoji, p.x, drawY-1);
    ctx.restore();

    if (!drown && !ragActive && idx===turn && !shot && !placingTeleport && allowInput){
      const ang=(p.angle*Math.PI)/180; const len=22;
      const x2=p.x+Math.cos(ang)*len; const y2=drawY-Math.sin(ang)*len;
      ctx.strokeStyle='#ffd166'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(p.x,drawY); ctx.lineTo(x2,y2); ctx.stroke();
    }

    if (p.emoteT>0 && p.emote){
      ctx.save();
      const emoteAlpha = Math.min(1, p.emoteT/30) * drawAlpha;
      ctx.globalAlpha = emoteAlpha;
      ctx.font='20px system-ui,emoji';
      ctx.fillText(p.emote, p.x, drawY-PLAYER_R-12);
      ctx.restore();
      p.emoteT--;
    }
  });

  // predicted path
  if (!shot && !placingTeleport && allowInput){
    const p=players[turn]; const ang=(p.angle*Math.PI)/180;
    const baseV = 0.9 * Math.max(1, (parseFloat(chargeBar.style.width)||0));
    let x = p.x + Math.cos(ang)*(PLAYER_R+6);
    let y = p.y - Math.sin(ang)*(PLAYER_R+6);
    let vx = Math.cos(ang)*Math.max(1,baseV), vy = -Math.sin(ang)*Math.max(1,baseV);
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=1.5; ctx.setLineDash([3,6]); ctx.beginPath(); ctx.moveTo(x,y);
    let hitX=x, hitY=y;
    for(let i=0;i<18;i++){
      if (weapon==='grenade'){ vy += G; x += vx; y += vy; }
      else { vx += wind; vy += G; x += vx; y += vy; }
      const ix=x|0, iy=y|0;
      if (ix<0||ix>=W||iy<0||iy>=H || (iy>=0 && terrainMask[iy*W+ix]===SOLID)){ hitX=x; hitY=y; break; }
      ctx.lineTo(x,y); hitX=x; hitY=y;
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.beginPath();
    ctx.moveTo(hitX-6,hitY); ctx.lineTo(hitX+6,hitY); ctx.moveTo(hitX,hitY-6); ctx.lineTo(hitX,hitY+6); ctx.stroke();
  }

  // Projectile
  if (shot){
    for(let i=0;i<2;i++) stepShot();

    if (shot && shot.kind==='normal'){
      const s=shot; ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1.2;
      ctx.beginPath(); for(let i=0;i<s.trail.length;i++){ const t=s.trail[i]; if (i===0) ctx.moveTo(t.x,t.y); else ctx.lineTo(t.x,t.y); } ctx.stroke();
      ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(s.x,s.y,3,0,Math.PI*2); ctx.fill();
    } else if (shot && shot.kind==='grenade'){
      const s=shot; ctx.strokeStyle='rgba(255,255,255,.45)'; ctx.lineWidth=1.2;
      ctx.beginPath(); for(let i=0;i<s.trail.length;i++){ const t=s.trail[i]; if (i===0) ctx.moveTo(t.x,t.y); else ctx.lineTo(t.x,t.y); } ctx.stroke();
      ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(s.x,s.y,4,0,Math.PI*2); ctx.fill();
      const secs = Math.max(0, Math.ceil(s.t/60));
      ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='12px system-ui'; ctx.textAlign='center';
      ctx.fillText(`${secs}s`, s.x, s.y-10);
    } else if (shot && shot.kind==='shotgun'){
      ctx.fillStyle='#ffd166';
      shot.pellets.forEach(p=>{
        ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1;
        ctx.beginPath(); const tr=p.trail; const start=Math.max(0,tr.length-10);
        for(let i=start;i<tr.length;i++){ const t=tr[i]; if (i===start) ctx.moveTo(t.x,t.y); else ctx.lineTo(t.x,t.y); } ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fill();
      });
    }
  }

  // Particles & rings
  for(let i=particles.length-1;i>=0;i--){
    const P=particles[i];
    if (P.water){
      P.vx *= 0.96;
      P.vy += 0.08;
    } else if (P.smoke){
      P.vx += wind*0.5;
      P.vy += 0.05;
    } else {
      P.vx += wind;
      P.vy += G*0.6;
    }
    P.x += P.vx; P.y += P.vy; P.life--;
    if (P.water){
      const alpha = Math.max(0, Math.min(1, P.life / 32));
      ctx.fillStyle = `rgba(120,180,255,${alpha})`;
      ctx.beginPath(); ctx.arc(P.x,P.y,2.4,0,Math.PI*2); ctx.fill();
    } else if (P.smoke){
      ctx.globalAlpha = Math.max(0, (P.alpha ?? 0.5) * P.life / 70);
      ctx.fillStyle='#cbd5e1'; ctx.beginPath(); ctx.arc(P.x,P.y,3.5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    } else {
      ctx.fillStyle='#9aa5bf'; ctx.beginPath(); ctx.arc(P.x,P.y,2.2,0,Math.PI*2); ctx.fill();
    }
    if (P.life<=0 || P.y > H + 24) particles.splice(i,1);
  }
  for(let i=rings.length-1;i>=0;i--){
    const R=rings[i]; R.r+=2.4; R.alpha*=0.92;
    const color = R.water ? `rgba(120,180,255,${R.alpha})` : `rgba(255,255,255,${R.alpha})`;
    ctx.strokeStyle=color; ctx.lineWidth = R.water ? 1.6 : 2;
    ctx.beginPath(); ctx.arc(R.x,R.y,R.r,0,Math.PI*2); ctx.stroke();
    if (R.alpha<0.02) rings.splice(i,1);
  }

  // Damage numbers
  ctx.fillStyle='#fff'; ctx.font='14px system-ui'; ctx.textAlign='center';
  for (let i=dmgNums.length-1;i>=0;i--){
    const d=dmgNums[i]; d.y -= 0.5; d.life--; ctx.globalAlpha=Math.max(0,d.life/40);
    ctx.fillText(d.val, d.x, d.y); ctx.globalAlpha=1;
    if (d.life<=0) dmgNums.splice(i,1);
  }

  ctx.restore();

  // Position nameplates in DOM space
  positionNameplate(np1, players[0]);
  positionNameplate(np2, players[1]);

  // Step physics (after draw so aim arrow uses previous state)
  stepPlayers();
  processAIState();
  if (pendingWinner && frameNow >= pendingWinner.triggerAt){
    const data = pendingWinner;
    pendingWinner = null;
    announceWinner(data.idx, data.reason);
  }
}

function positionNameplate(el, p){
  const rect = cvs.getBoundingClientRect();
  let drawY = p.y;
  if (p.drowning){
    const elapsed = now() - p.drowning.start;
    const t = Math.min(1, elapsed / (p.drowning.duration || DROWN_DURATION));
    const sink = t * (PLAYER_R + 28);
    const bob = Math.sin(t * Math.PI * 4) * (1 - t) * 3;
    drawY = Math.min(p.y + sink + bob, waterLevelY + PLAYER_R + 6);
  }
  const sx = rect.left + (p.x * rect.width / W);
  const sy = rect.top + (drawY * rect.height / H);
  el.style.left = sx + 'px';
  el.style.top  = (sy - 22) + 'px';
}

// =====================
// = Shot End Helpers  =
// =====================
function endShotIfOut(x,y){
  if (x<0 || x>=W || y>=H) { endShot(null); return true; }
  return false;
}

// =====================
// = Game Reset/Boot   =
// =====================
function updateAll(){ updateHPPlates(); updateTurnUI(); updateWindUI(); }

function resetGame(newMap){
  readMenuSettings();
  updateWaterConfig(true);
  aiMemory.lastSolution = null;
  resetAIState();
  pendingWinner = null;

  // Stats reset
  stats.shots=[0,0]; stats.hits=[0,0]; stats.bestHit=[0,0];

  // Player reset
  for (let i=0;i<2;i++){
    players[i].hp=100; players[i].vx=players[i].vy=0;
    players[i].ammo={
      shotgun: wShotgun.checked? (ammoChk.checked?5:Infinity) : 0,
      grenade: wGrenade.checked? (ammoChk.checked?5:Infinity) : 0,
      teleport: wTeleport.checked? (ammoChk.checked?1:Infinity) : 0
    };
    players[i].fuse = 5;
    if (newMap) players[i].lastWeapon = Weapons.NORMAL;
    players[i].drowning = null;
    lastGroundedAt[i] = now();
    lastJumpPressedAt[i] = -9999;
    lastJumpAt[i]        = -9999;
  }
  updateHPPlates();

  // Reset general
  shot=null; turn=0; placingTeleport=false;
  cam.scale=1; cam.targetScale=1;
  allowInput = true;
  fireBtn.disabled=false;

  // Terrain re-seed
  srand(mapSeed);
  generateTerrain();

  players[turn].emote='😼'; players[turn].emoteT=80;
  weapon = players[turn].lastWeapon || Weapons.NORMAL;
  updateTurnUI(); drawMiniPreview();

  // Joystick visibility
  if (isTouch && movementOn) showJoystick(); else hideJoystick();

  // Timer
  resetTurnTimer();
}

// Boot: open menu initially and prepare a previewed map
menuPanel.style.display='block';
mapSeed = Math.random().toString(36).slice(2,8);
seedTxt.value = mapSeed;
srand(mapSeed);
readMenuSettings();
updateWaterConfig(true);
generateTerrain();
updateAll();
(function loop(){draw();})();

})();
