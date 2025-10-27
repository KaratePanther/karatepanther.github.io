(()=>{
// =========================
// = Canvas & Core Setup  =
// =========================
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d', { alpha: true });
const stage = document.getElementById('stage');

const W = cvs.width, H = cvs.height;
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
// Live-toggle movement + joystick when menu option changes
moveSel.addEventListener('change', () => {
  movementOn = (moveSel.value === 'on');
  if (isTouch && movementOn) showJoystick(); else hideJoystick();
});
const fallChk   = document.getElementById('fallChk');
const ammoChk   = document.getElementById('ammoChk');
const wShotgun  = document.getElementById('wShotgun');
const wGrenade  = document.getElementById('wGrenade');
const wTeleport = document.getElementById('wTeleport');
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

function generateTerrain(){
  terrCtx.clearRect(0,0,W,H);
  decalCtx.clearRect(0,0,W,H);
  terrainMask.fill(SKY); heightmap.fill(H);

  const base = new Float32Array(W);
  let y = H*0.55 + (rand()*80-40); let dy = 0;
  for(let x=0;x<W;x++){ dy += (rand()-0.5)*2; dy*=0.95; y += dy; base[x]=y; }
  const smooth = new Float32Array(W);
  const K=14; let acc=0;
  for(let x=0;x<W+K;x++){ if(x<W) acc+=base[x]; if(x>=K) acc-=base[x-K];
    if(x>=K-1) smooth[x-(K-1)] = acc/Math.min(x+1,K,W);
  }
  for(let x=0;x<W;x++){
    let yy = smooth[x] + Math.sin(x*0.01)*14 + Math.sin(x*0.053)*8;
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
  terrCtx.strokeStyle = '#2ecc71'; terrCtx.lineWidth=2; terrCtx.beginPath();
  for(let x=0;x<W;x++) terrCtx.lineTo(x+0.5, heightmap[x]-1.5);
  terrCtx.stroke();

  placePlayers();
  randomizeWind();
  drawMiniPreview();
}

function placePlayers(){
  function findSurfaceX(x0,x1){
    for(let tries=0;tries<500;tries++){
      const x = Math.floor(x0 + rand()*(x1-x0));
      const y = heightmap[x]-PLAYER_R;
      if (y>0 && y<H-PLAYER_R){
        const left = heightmap[Math.max(0,x-6)];
        const right= heightmap[Math.min(W-1,x+6)];
        if (Math.abs(left-right) < 20) return {x,y};
      }
    }
    return {x:Math.floor((x0+x1)/2), y:heightmap[Math.floor((x0+x1)/2)]-PLAYER_R};
  }
  const a=findSurfaceX(40, W/2-80);
  const b=findSurfaceX(W/2+80, W-40);
  const placeB = (Math.abs(b.x - a.x) < 220) ? findSurfaceX(W-200, W-40) : b;

  Object.assign(players[0], {x:a.x, y:a.y, vx:0, vy:0, facing:1, angle:45});
  Object.assign(players[1], {x:placeB.x, y:placeB.y, vx:0, vy:0, facing:-1, angle:135});
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
    ammo:{ shotgun:5, grenade:5, teleport:1 } },
  { name:'P2', emoji:'😺', color:'#90c2ff', x:0, y:0, vx:0, vy:0, hp:100, angle:135, facing:-1,
    emote:null, emoteT:0, lastPower:50, lastWeapon:Weapons.NORMAL, fuse:5,
    ammo:{ shotgun:5, grenade:5, teleport:1 } }
];
let turn = 0;
let weapon = Weapons.NORMAL;

let aiEnabled = false;
let shot = null;
let particles = [];
let rings = [];
let dmgNums = [];
const stats = { shots:[0,0], hits:[0,0], bestHit:[0,0] };
let placingTeleport = false;

// Movement options & state
let movementOn = false;
const MOVE = {
  accel: 0.06,
  max: 0.8,
  friction: 0.85,
  jumpVy: -3.6,
  hopBoost: 1.2,
  jumpCooldown: 300,
  coyoteMs: 120,
  bufferMs: 120,
};
let allowInput = true; // blocked during projectile & menu
let keys = {};
let lastGroundedAt = [0,0];   // timestamps per player
let lastJumpPressedAt = [0,0];
let lastJumpAt = [ -9999, -9999 ];

function now(){ return performance.now(); }

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

  movementOn = (moveSel.value==='on');

  const tv = timerSel.value;
  turnTimerMs = (tv==='off') ? 0 : parseInt(tv,10)*1000;
}

function pickNewSeedAndPreview(){
  mapSeed = Math.random().toString(36).slice(2,8);
  seedTxt.value = mapSeed;
  srand(mapSeed);
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
  if (players[0].hp>0 && players[1].hp>0){
    // Switch turn
    turn = 1 - turn;
    cam.targetScale = Math.max(cam.min, Math.min(cam.max, cam.targetScale));
    cam.scale       = Math.max(cam.min, Math.min(cam.max, cam.scale));

    weapon = players[turn].lastWeapon || 'normal';
    updateTurnUI();
    wind = Math.max(-WIND_MAX, Math.min(WIND_MAX, wind + (Math.random()*0.06 - 0.03)));
    updateWindUI();
    players[turn].emote = ['😼','😹','😾','😺','😸'][Math.floor(Math.random()*5)];
    players[turn].emoteT = 80;
    ensureAmmoOrSwitch();

    // Prep next turn timer & inputs
    resetTurnTimer();

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
function applyDamage(index, dmg, direct=false){
  const pl = players[index];
  pl.hp = Math.max(0, pl.hp - dmg);
  updateHPPlates();
  if (pl.hp<=0){ announceWinner(1-index, direct ? 'direct hit!' : 'boom!'); }
}
function announceWinner(idx, reason){
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
      if (dmg>0){
        applyDamage(i,dmg,false);
        floatDmg(pl.x, pl.y-PLAYER_R-8, -dmg);
        stats.bestHit[turn]=Math.max(stats.bestHit[turn], dmg);
        stats.hits[turn]++;
      }
      const k = 3.4*scale;
      const nx = (pl.x - cx) / Math.max(1, d);
      const ny = (pl.y - cy) / Math.max(1, d);
      pl.vx += nx * k; pl.vy += ny * k - 0.3;
    }
  }
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

    if (s.x<0 || s.x>=W || s.y>=H){ endShot(null); return; }

    const opp = players[1-turn];
    const dx=s.x-opp.x, dy=s.y-opp.y;
    if (dx*dx + dy*dy <= (PLAYER_R*PLAYER_R)*0.9){
      const dmg = 50;
      applyDamage(1-turn, dmg, true);
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
    for (let k=pellets.length-1;k>=0;k--){
      const p=pellets[k];
      p.vx += wind; p.vy += G; p.x += p.vx; p.y += p.vy;
      p.trail.push({x:p.x,y:p.y}); if (p.trail.length>80) p.trail.shift();
      if (p.x<0 || p.x>=W || p.y>=H){ pellets.splice(k,1); continue; }
      const ix=p.x|0, iy=p.y|0;
      const opp = players[1-turn];
      const dx=p.x-opp.x, dy=p.y-opp.y;
      if (dx*dx+dy*dy <= (PLAYER_R*PLAYER_R)*0.85){
        const perPellet = 16;
        const left = Math.max(0, 50 - (shot.dealt||0));
        const hit = Math.min(perPellet, left);
        if (hit > 0){
          applyDamage(1-turn, hit, true);
          floatDmg(opp.x, opp.y-PLAYER_R-8, -hit);
          shot.dealt = (shot.dealt||0) + hit;
          const d=Math.max(1,Math.hypot(dx,dy));
          opp.vx += (dx/d)*0.6; opp.vy += (dy/d)*0.35-0.2;
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
    if (pellets.length===0){ noiseBoom(0.2,0.2); endShot({terrain:true}); }
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
  const rect=cvs.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (W/rect.width);
  const py = (e.clientY - rect.top)  * (H/rect.height);
  const p = players[turn];
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
function showJoystick(){ if (!movementOn) return; joystick.classList.remove('hidden'); }
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
  // called during step based on keys/joystick
  if (!movementOn || !allowInput) return;

  const p = players[turn];
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

    // Apply movement input for current turn player
    if (i===turn) setMoveForTurnPlayer();

    let onSolid = isGrounded(p);
    if (p.vy < 0) onSolid = false; // let jump impulse lift the cat off the ground

    if (!onSolid){
      p.vy += G;
      p.y += p.vy;
      p.x += p.vx;

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
        p.vx *= 0.6;

        // landing puff
        if (Math.abs(prevVy) > 1.2){
          for(let k=0;k<6;k++){
            const a=Math.random()*Math.PI, sp=1+Math.random()*1.4;
            particles.push({x:p.x,y:p.y+PLAYER_R,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-0.4,life:24,smoke:true,alpha:.5});
          }
        }

        if (fallChk.checked){
          const drop = Math.abs(prevVy*8 + over);
          if (drop>FALL_NO_DMG){
            const dmg = Math.min(25, Math.round((drop - FALL_NO_DMG)/6));
            if (dmg>0){ applyDamage(i, dmg, false); floatDmg(p.x, p.y-PLAYER_R-8, -dmg); }
          }
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
      if (sl < H && sr < H){
        const slope = (sr - sl) / 4;
        if (Math.abs(slope) > 0.5) { p.x += slope * 0.25; }
      }

      // Move horizontally while grounded
      p.x += p.vx;
      const gyAfter = groundYAt(p.x, p.y + PLAYER_R + 1);
      if (gyAfter < H && p.y + PLAYER_R > gyAfter){
        p.y = gyAfter - PLAYER_R;
      }

      // Ground friction & zero vertical velocity
      p.vx *= MOVE.friction;
      p.vy = 0;

      // Remember last time we were grounded (for coyote-time jumps)
      lastGroundedAt[i] = now();
    }

    // Bounds
    p.x = Math.max(PLAYER_R, Math.min(W-PLAYER_R, p.x));
    p.y = Math.max(PLAYER_R, Math.min(H-PLAYER_R, p.y));
  }
}

// ======================
// = AI (no walking)    =
// ======================
function aiPlay(){
  if (!aiEnabled || turn!==1 || shot) return;
  const me = players[1], you = players[0];
  const dx = you.x - me.x, dy = me.y - you.y;
  const dist = Math.hypot(dx,dy);
  const heightDiff = Math.abs(dy);

  const canGrenade = wGrenade.checked && (!ammoChk.checked || me.ammo.grenade>0);
  const canShotgun = wShotgun.checked && (!ammoChk.checked || me.ammo.shotgun>0);

  const preferGrenade = canGrenade && dist>220 && dist<520 && heightDiff<180;
  const preferShotgun = canShotgun && dist<180 && heightDiff<80;

  if (preferShotgun){
    weapon='shotgun';
  } else if (preferGrenade){
    weapon='grenade';
  } else {
    weapon='normal';
  }
  me.lastWeapon = weapon;

  const diff = diffSel.value;
  let angle = me.angle;
  let power = Math.min(95, Math.max(30, me.lastPower||55));

  if (diff==='Easy'){
    angle = 15 + Math.random()*330;
    power = 30 + Math.random()*55;
  } else {
    const coarseStep = (diff==='Medium') ? 8 : 4;
    const powerStep  = (diff==='Medium') ? 8 : 4;
    let best = searchShotSolution(me, you, weapon, coarseStep, powerStep);

    if (diff==='Hard' && best.miss<1e8){
      best = refineShotSolution(me, you, weapon, best, 2, 2);
    }

    if (!best || !isFinite(best.miss) || best.miss>260){
      angle = 20 + Math.random()*320;
      power = 35 + Math.random()*50;
    } else {
      angle = best.angle;
      power = Math.max(28, Math.min(98, best.power));
      if (weapon==='grenade'){
        const fuseSeconds = Math.max(1, Math.min(5, Math.round(best.flight/60)));
        me.fuse = fuseSeconds;
      }
      if (diff==='Medium'){
        angle += (Math.random()*6 - 3);
        power += (Math.random()*12 - 6);
      }
    }
  }

  angle = ((angle%360)+360)%360;
  power = Math.max(20, Math.min(100, power));
  me.angle = Math.round(angle);
  me.lastPower = power;
  updateBadge();

  if (weapon==='teleport' && wTeleport.checked && (!ammoChk.checked || me.ammo.teleport>0)){
    const tx = (me.x*0.4 + you.x*0.6); const ty = groundYAt(tx)-PLAYER_R-2;
    if (ammoChk.checked) me.ammo.teleport = Math.max(0, me.ammo.teleport-1);
    whoosh(); me.x=tx; me.y=ty; poof(); updateBadge();
    lockInputsForShot(); setTimeout(()=>endShot(),200); return;
  }
  if (weapon==='shotgun') launchShot(power);
  else launchShot(power);
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

  ctx.save();
  ctx.clearRect(0,0,W,H);
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0b1020'); g.addColorStop(1,'#0e1430');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  ctx.translate(W/2, H/2); ctx.scale(cam.scale, cam.scale); ctx.translate(-W/2, -H/2);

  ctx.drawImage(terrCanvas,0,0);
  ctx.drawImage(decalCanvas,0,0);

  // Players
  players.forEach((p,idx)=>{
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y+PLAYER_R-2, PLAYER_R*0.8, 5, 0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = idx===0 ? '#6ea8fe' : '#90c2ff';
    ctx.beginPath(); ctx.arc(p.x,p.y,PLAYER_R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.stroke();

    ctx.font='18px system-ui,emoji'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.emoji, p.x, p.y-1);

    if (idx===turn && !shot && !placingTeleport && allowInput){
      const ang=(p.angle*Math.PI)/180; const len=22;
      const x2=p.x+Math.cos(ang)*len; const y2=p.y-Math.sin(ang)*len;
      ctx.strokeStyle='#ffd166'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(x2,y2); ctx.stroke();
    }

    if (p.emoteT>0 && p.emote){
      ctx.globalAlpha=Math.min(1, p.emoteT/30);
      ctx.font='20px system-ui,emoji';
      ctx.fillText(p.emote, p.x, p.y-PLAYER_R-12);
      ctx.globalAlpha=1; p.emoteT--;
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
    if (P.smoke){ P.vx += wind*0.5; P.vy += 0.05; } else { P.vx += wind; P.vy += G*0.6; }
    P.x += P.vx; P.y += P.vy; P.life--;
    if (P.smoke){ ctx.globalAlpha=Math.max(0, (P.alpha??0.5) * P.life/70); ctx.fillStyle='#cbd5e1'; ctx.beginPath(); ctx.arc(P.x,P.y,3.5,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    else { ctx.fillStyle='#9aa5bf'; ctx.beginPath(); ctx.arc(P.x,P.y,2.2,0,Math.PI*2); ctx.fill(); }
    if (P.life<=0) particles.splice(i,1);
  }
  for(let i=rings.length-1;i>=0;i--){
    const R=rings[i]; R.r+=2.6; R.alpha*=0.92;
    ctx.strokeStyle=`rgba(255,255,255,${R.alpha})`; ctx.lineWidth=2;
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
}

function positionNameplate(el, p){
  const rect = cvs.getBoundingClientRect();
  const sx = rect.left + (p.x * rect.width / W);
  const sy = rect.top + (p.y * rect.height / H);
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
generateTerrain(); updateAll(); (function loop(){draw();})();

})();
