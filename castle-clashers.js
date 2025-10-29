// Castle Clashers — MVP (same-device, two-player)
// Canvas-based simple lane battler inspired by Clash Royale.
// P1 bottom, P2 top. Two lanes (left/right). Units: Knight (melee), Archer (ranged).

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const handP1 = document.getElementById('handP1');
  const handP2 = document.getElementById('handP2');
  const manaBarP1 = document.getElementById('manaP1');
  const manaBarP2 = document.getElementById('manaP2');
  const deployStatusP1 = document.getElementById('deployStatusP1');
  const deployStatusP2 = document.getElementById('deployStatusP2');
  const statusEl = document.getElementById('status');
  const timeEl = document.getElementById('time');

  const startOverlay = document.getElementById('start-overlay');
  const endOverlay = document.getElementById('end-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseRestartBtn = document.getElementById('pauseRestartBtn');
  const pauseMenuBtn = document.getElementById('pauseMenuBtn');
  const endMenuBtn = document.getElementById('endMenuBtn');
  const resultTitle = document.getElementById('result-title');
  const soundToggleButtons = Array.from(document.querySelectorAll('.sound-toggle'));
  const spellOptionContainers = {
    P1: handP1 ? handP1.querySelector('.spell-opts') : null,
    P2: handP2 ? handP2.querySelector('.spell-opts') : null,
  };
  const modeInputs = Array.from(document.querySelectorAll('input[name="mode"]'));
  const difficultyInputs = Array.from(document.querySelectorAll('input[name="difficulty"]'));
  const difficultySection = document.getElementById('difficultySection');
  if (pauseBtn) pauseBtn.disabled = true;

  // ---- Constants ----
  const W = canvas.width;
  const H = canvas.height;

  const FIELD = { top: 60, bottom: H-60, left: 30, right: W-30 };
  const MID_Y = H / 2;
  const RIVER_Y = MID_Y;
  const LANE_LEFT_X  = W * 0.32;
  const LANE_RIGHT_X = W * 0.68;

  const TICK_MS = 100; // simulation tick
  const RENDER_FPS = 60; // rendering
  const MAX_UNITS_PER_SIDE = 12;
  const NO_SPAWN_MARGIN = 40; // keep away from river slightly

  // Match timing
  const MATCH_SECONDS = 180; // 3:00
  const DOUBLE_MANA_START = 120; // last 60s are double
  const MANA_CAP = 10;
  const DEPLOY_COOLDOWN = 0.5;

  // Towers / King stats
  const SIDE_TOWER_HP = 1500;
  const KING_HP = 3000;
  const SIDE_TOWER_DMG = 80;
  const SIDE_TOWER_CADENCE = 0.8; // s/shot
  const SIDE_TOWER_RANGE = 140; // px
  const KING_DMG = 120;
  const KING_CADENCE = 1.0;
  const KING_RANGE = 170;

  // Fireball spell
  const FIREBALL_RADIUS = 110;
  const FIREBALL_DELAY = 0.45;
  const FIREBALL_UNIT_DAMAGE = 350;
  const FIREBALL_TOWER_DAMAGE = 400;
  const FIREBALL_KING_DAMAGE = 300;

  // Units
  const Cards = {
    knight: { cost: 3, hp: 800, dps: 80, range: 16, speed: 60, cooldown: 4.0, melee: true, radius: 14, targetsUnits: true, targetsBuildings: true, atkInterval: 0.5 },
    archer: { cost: 2, hp: 300, dps: 60, range: 120, speed: 60, cooldown: 3.0, melee: false, radius: 12, targetsUnits: true, targetsBuildings: true, atkInterval: 0.7 },
    goblin: { cost: 2, hp: 250, dps: 60, range: 16, speed: 90, cooldown: 3.0, melee: true, radius: 12, targetsUnits: true, targetsBuildings: true, atkInterval: 0.4 },
    giant: { cost: 5, hp: 2000, dps: 150, range: 24, speed: 40, cooldown: 6.0, melee: true, radius: 18, targetsUnits: false, targetsBuildings: true, atkInterval: 1.0 },
    fireball: { cost: 4, cooldown: 5.0, spell: true, radius: FIREBALL_RADIUS },
  };

  // ---- Game State ----
  let rngSeed = 1337;
  const rnd = () => (rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0) / 0xffffffff;

  const cardKeys = Object.keys(Cards);
  const makeCooldowns = () => {
    const obj = {};
    for (const key of cardKeys) obj[key] = 0;
    return obj;
  };

  const gameConfig = { mode: 'ai', difficulty: 'medium' };
  let loopHandle = null;

  function getSelectedMode() {
    const selected = modeInputs.find(input => input.checked);
    return selected ? selected.value : 'pvp';
  }

  function getSelectedDifficulty() {
    const selected = difficultyInputs.find(input => input.checked);
    return selected ? selected.value : 'medium';
  }

  function toggleDifficultySection(mode) {
    if (!difficultySection) return;
    const isAi = mode === 'ai';
    difficultySection.hidden = !isAi;
    difficultyInputs.forEach(input => {
      input.disabled = !isAi;
    });
  }

  const state = {
    timeLeft: MATCH_SECONDS,
    phase: 'menu', // 'menu' | 'playing' | 'paused' | 'ended'
    mode: 'pvp',
    difficulty: 'easy',
    paused: false,
    p1: {
      mana: 5, selected: 'knight',
      cooldowns: makeCooldowns(),
      deployCd: 0,
    },
    p2: {
      mana: 5, selected: 'knight',
      cooldowns: makeCooldowns(),
      deployCd: 0,
    },
    units: [], // array of Unit
    towers: [],
    effects: [],
    projectiles: [],
    spellQueue: [],
    ai: null,
    nextId: 1,
    lastTick: performance.now(),
  };

  const audio = (() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let unlocked = false;
    let muted = true;
    const buffers = new Map();
    const manifest = {
      spawn: [600, 0.04],
      towerShot: [320, 0.08],
      hit: [120, 0.05],
      kingHit: [80, 0.3],
      victory: [440, 0.4],
      fireballCast: [520, 0.14],
      fireballImpact: [90, 0.45],
    };

    const ensureBuffer = (name) => {
      if (buffers.has(name)) return buffers.get(name);
      const [freq, len] = manifest[name] || [440, 0.2];
      const sampleRate = ctx.sampleRate;
      const frameCount = Math.max(1, Math.floor(sampleRate * len));
      const buffer = ctx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        const t = i / sampleRate;
        const env = Math.pow(1 - i / frameCount, 2);
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.3;
      }
      buffers.set(name, buffer);
      return buffer;
    };

    const play = (name, options = {}) => {
      if (!unlocked || muted) return;
      const buffer = ensureBuffer(name);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = options.volume ?? 0.55;
      src.connect(gain).connect(ctx.destination);
      src.start();
    };

    const unlock = () => {
      if (unlocked) return;
      try {
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        unlocked = true;
      } catch (err) {
        console.warn('Audio unlock failed', err);
      }
    };

    const setMuted = (value) => {
      muted = value;
    };

    return {
      ctx,
      play,
      unlock,
      setMuted,
      isMuted: () => muted,
    };
  })();

  function addHitEffect(x, y, color, radius = 20) {
    state.effects.push({ x, y, color, radius, life: 0.28, maxLife: 0.28 });
    if (state.effects.length > 160) state.effects.splice(0, state.effects.length - 160);
  }

  function spawnProjectile(config, onImpact) {
    const start = { x: config.start.x, y: config.start.y };
    const targetPos = config.targetUnit
      ? { x: config.targetUnit.pos.x, y: config.targetUnit.pos.y }
      : { x: config.targetPos.x, y: config.targetPos.y };
    const dx = targetPos.x - start.x;
    const dy = targetPos.y - start.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const speed = config.speed || 500;
    const travelTime = distance / speed;
    const projectile = {
      owner: config.owner,
      color: config.color,
      start,
      targetPos,
      followUnit: config.targetUnit || null,
      progress: travelTime <= 0 ? 1 : 0,
      travelTime: travelTime <= 0 ? 0.0001 : travelTime,
      kind: config.kind || 'arrow',
      onImpact,
    };
    if (projectile.progress >= 1) {
      if (onImpact) onImpact();
    } else {
      state.projectiles.push(projectile);
    }
  }

  function getPlayer(owner) {
    return owner === 'P1' ? state.p1 : state.p2;
  }

  function getUnitCount(owner) {
    return state.units.reduce((acc, u) => acc + (u.owner === owner ? 1 : 0), 0);
  }

  function canSpawn(owner, cardKey) {
    const card = Cards[cardKey];
    if (!card) return { ok: false, reason: 'invalid_card', card: null };
    const player = getPlayer(owner);
    const isSpell = !!card.spell;
    if (!isSpell && player.deployCd > 0) {
      return { ok: false, reason: 'deploy_cd', card };
    }
    if (player.mana < card.cost) {
      return { ok: false, reason: 'mana', card };
    }
    if ((player.cooldowns[cardKey] || 0) > 0) {
      return { ok: false, reason: 'card_cd', card };
    }
    if (!isSpell && getUnitCount(owner) >= MAX_UNITS_PER_SIDE) {
      return { ok: false, reason: 'unit_cap', card };
    }
    return { ok: true, reason: null, card };
  }

  function formatCooldown(sec) {
    if (sec >= 10) return Math.round(sec).toString();
    if (sec >= 1) return sec.toFixed(0);
    return sec.toFixed(1);
  }

  function describeSpawnFailure(player, cardKey, result) {
    const label = player === 'P1' ? 'Player 1' : 'Player 2';
    const cardLabel = cardKey ? cardKey.charAt(0).toUpperCase() + cardKey.slice(1) : 'Unit';
    switch (result.reason) {
      case 'mana':
        return `${label}: Need ${result.card ? result.card.cost : '?'} mana.`;
      case 'card_cd':
        return `${label}: ${cardLabel} cooling down.`;
      case 'deploy_cd':
        return `${label}: Deploy cooldown.`;
      case 'unit_cap':
        return `${label}: Unit cap reached.`;
      case 'spell_only':
        return `${label}: Tap a spell target to cast.`;
      case 'invalid_target':
        return `${label}: Invalid target for ${cardLabel}.`;
      default:
        return `${label}: Cannot deploy.`;
    }
  }

  // Place towers & kings
  function initTowers() {
    state.towers = [
      mkTower('P1','side', 'P1L', {x: LANE_LEFT_X,  y: H-110}, SIDE_TOWER_HP, SIDE_TOWER_DMG, SIDE_TOWER_CADENCE, SIDE_TOWER_RANGE),
      mkTower('P1','side', 'P1R', {x: LANE_RIGHT_X, y: H-110}, SIDE_TOWER_HP, SIDE_TOWER_DMG, SIDE_TOWER_CADENCE, SIDE_TOWER_RANGE),
      mkTower('P1','king', 'P1K', {x: W/2, y: H-60}, KING_HP, KING_DMG, KING_CADENCE, KING_RANGE),
      mkTower('P2','side', 'P2L', {x: LANE_LEFT_X,  y: 110}, SIDE_TOWER_HP, SIDE_TOWER_DMG, SIDE_TOWER_CADENCE, SIDE_TOWER_RANGE),
      mkTower('P2','side', 'P2R', {x: LANE_RIGHT_X, y: 110}, SIDE_TOWER_HP, SIDE_TOWER_DMG, SIDE_TOWER_CADENCE, SIDE_TOWER_RANGE),
      mkTower('P2','king', 'P2K', {x: W/2, y: 60}, KING_HP, KING_DMG, KING_CADENCE, KING_RANGE),
    ];
  }
  function mkTower(owner, kind, id, pos, hp, atk, cadence, range) {
    return { owner, kind, id, pos, hp, atk, cadence, range, cd: 0 };
  }

  // ---- Units ----
  function spawnUnit(owner, cardKey, laneX, y, precheck) {
    const validation = precheck || canSpawn(owner, cardKey);
    if (!validation.ok) return validation;
    const card = validation.card || Cards[cardKey];
    if (!card) return { ok: false, reason: 'invalid_card', card: null };
    if (card.spell) return { ok: false, reason: 'spell_only', card };
    const player = getPlayer(owner);

    // Spend & set cooldown
    player.mana -= card.cost;
    player.cooldowns[cardKey] = card.cooldown;
    player.deployCd = DEPLOY_COOLDOWN;

    const id = 'U' + state.nextId++;
    const dir = owner === 'P1' ? -1 : +1; // P1 goes upward, P2 downward

    const u = {
      id, owner, type: cardKey,
      pos: {x: laneX, y},
      laneX,
      hp: card.hp,
      dps: card.dps,
      range: card.range,
      speed: card.speed, // px/s
      melee: !!card.melee,
      targetId: null,
      targetType: null,
      atkCd: 0,
      atkInterval: card.atkInterval || 0.5,
      facing: dir,
      radius: card.radius || 14,
      targetsUnits: card.targetsUnits !== false,
      targetsBuildings: card.targetsBuildings !== false,
    };
    state.units.push(u);
    updateManaBars();
    return { ok: true, unit: u };
  }

  // ---- Input / UI ----
  function setActiveCardFor(player, cardKey) {
    const handEl = player === 'P1' ? handP1 : handP2;
    for (const btn of handEl.querySelectorAll('.card')) btn.classList.toggle('active', btn.dataset.card === cardKey);
    (player === 'P1' ? state.p1 : state.p2).selected = cardKey;
    updateHandState(player);
  }

  function updateManaBars() {
    const updatePlayer = (playerId, manaBar) => {
      const playerState = getPlayer(playerId);
      const pct = Math.min(100, Math.floor((playerState.mana / MANA_CAP) * 100));
      const fill = manaBar.querySelector('.fill');
      const label = manaBar.querySelector('span');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = Math.floor(playerState.mana);
      updateHandState(playerId);
    };
    updatePlayer('P1', manaBarP1);
    updatePlayer('P2', manaBarP2);
  }

  function updateHandState(playerId) {
    const handEl = playerId === 'P1' ? handP1 : handP2;
    if (!handEl) return;
    const playerState = getPlayer(playerId);
    const deployStatusEl = playerId === 'P1' ? deployStatusP1 : deployStatusP2;
    const unitCount = getUnitCount(playerId);
    const atCap = unitCount >= MAX_UNITS_PER_SIDE;
    const deployCd = playerState.deployCd || 0;

    if (deployStatusEl) {
      if (deployCd > 0) {
        deployStatusEl.textContent = `Deploy in ${formatCooldown(deployCd)}s`;
        deployStatusEl.classList.add('cooldown');
      } else if (atCap) {
        deployStatusEl.textContent = 'Unit cap reached';
        deployStatusEl.classList.add('cooldown');
      } else {
        deployStatusEl.textContent = 'Deploy Ready';
        deployStatusEl.classList.remove('cooldown');
      }
    }

    const globalLocked = deployCd > 0;
    for (const btn of handEl.querySelectorAll('.card')) {
      const cardKey = btn.dataset.card;
      const card = Cards[cardKey];
      if (!card) continue;
      const cardCd = playerState.cooldowns[cardKey] || 0;
      const notEnoughMana = playerState.mana + 1e-3 < card.cost;
      const ratio = card.cooldown ? Math.min(1, Math.max(0, cardCd / card.cooldown)) : 0;
      const isSpell = !!card.spell;

      if (cardCd > 0) {
        btn.dataset.cd = formatCooldown(cardCd);
        btn.style.setProperty('--cd-ratio', ratio.toFixed(3));
      } else {
        btn.removeAttribute('data-cd');
        btn.style.removeProperty('--cd-ratio');
      }

      btn.classList.toggle('cooldown-card', cardCd > 0);
      btn.classList.toggle('insufficient', notEnoughMana);
      btn.classList.toggle('unit-cap', !isSpell && !notEnoughMana && !cardCd && atCap);
      btn.classList.toggle('deploy-locked', !isSpell && !notEnoughMana && !cardCd && !atCap && globalLocked);
    }
    updateSpellOptionsForPlayer(playerId);
  }

  function updateSpellOptionsForPlayer(playerId) {
    const container = spellOptionContainers[playerId];
    if (!container) return;
    const playerState = getPlayer(playerId);
    const selected = playerState.selected || 'knight';
    const card = Cards[selected];
    const show = !!card && !!card.spell;
    container.hidden = !show;
    if (!show) return;
    const validation = canSpawn(playerId, selected);
    container.classList.toggle('not-ready', !validation.ok);
    container.querySelectorAll('.spell-option').forEach(btn => {
      btn.disabled = !validation.ok;
    });
  }

  // Card clicks (both hands)
  document.querySelectorAll('.card').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const player = btn.dataset.player;
      const card = btn.dataset.card;
      setActiveCardFor(player, card);
    });
  });
  document.querySelectorAll('.spell-option').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const player = btn.dataset.player;
      const target = btn.dataset.target;
      handleSpellOption(player, target);
    });
  });

  modeInputs.forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) toggleDifficultySection(input.value);
    });
  });
  toggleDifficultySection(getSelectedMode());

  // Start / restart
  startBtn.addEventListener('click', () => {
    audio.unlock();
    const mode = getSelectedMode();
    const difficulty = getSelectedDifficulty();
    gameConfig.mode = mode;
    gameConfig.difficulty = difficulty;
    startMatch(gameConfig);
  });
  restartBtn.addEventListener('click', () => {
    endOverlay.hidden = true;
    audio.unlock();
    startMatch(gameConfig);
  });
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      audio.unlock();
      enterPause();
    });
  }
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      audio.unlock();
      exitPause();
    });
  }
  if (pauseRestartBtn) {
    pauseRestartBtn.addEventListener('click', () => {
      audio.unlock();
      pauseOverlay.hidden = true;
      startMatch(gameConfig);
    });
  }
  if (pauseMenuBtn) {
    pauseMenuBtn.addEventListener('click', () => {
      goToMainMenu();
    });
  }
  if (endMenuBtn) {
    endMenuBtn.addEventListener('click', () => {
      goToMainMenu();
    });
  }
  const updateSoundButtons = () => {
    const muted = audio.isMuted();
    soundToggleButtons.forEach(btn => {
      btn.setAttribute('aria-pressed', (!muted).toString());
      btn.textContent = 'Sound: ' + (muted ? 'Off' : 'On');
    });
  };
  soundToggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const nextMuted = !audio.isMuted();
      audio.setMuted(nextMuted);
      updateSoundButtons();
    });
  });
  updateSoundButtons();

  function handleSpellOption(player, targetKey) {
    if (state.phase !== 'playing') return;
    const playerLabel = player === 'P1' ? 'Player 1' : 'Player 2';
    const playerState = getPlayer(player);
    const selected = playerState.selected || 'knight';
    const card = Cards[selected];
    if (!card || !card.spell) {
      flashStatus(`${playerLabel}: Select a spell first.`);
      return;
    }
    const result = castSpell(player, selected, targetKey);
    if (!result.ok) {
      flashStatus(describeSpawnFailure(player, selected, result));
    }
  }

  function castSpell(player, cardKey, targetKey) {
    const card = Cards[cardKey];
    if (!card || !card.spell) return { ok: false, reason: 'invalid_card', card };
    const validation = canSpawn(player, cardKey);
    if (!validation.ok) return validation;
    let spellData = null;
    if (cardKey === 'fireball') {
      const target = getFireballTarget(player, targetKey);
      if (!target) return { ok: false, reason: 'invalid_target', card };
      spellData = { target };
    }

    const playerState = getPlayer(player);
    playerState.mana -= card.cost;
    playerState.cooldowns[cardKey] = card.cooldown;
    updateManaBars();

    if (cardKey === 'fireball' && spellData) {
      const target = spellData.target;
      const radius = FIREBALL_RADIUS;
      const color = player === 'P1' ? '#f97316' : '#fb923c';
      state.spellQueue.push({ type: 'fireball', owner: player, target, radius, timer: FIREBALL_DELAY });
      state.effects.push({ kind: 'telegraph', x: target.x, y: target.y, radius, life: FIREBALL_DELAY, maxLife: FIREBALL_DELAY, color });
      const king = state.towers.find(t => t.owner === player && t.kind === 'king');
      const startPos = king ? { x: king.pos.x, y: king.pos.y } : { x: W/2, y: player === 'P1' ? FIELD.bottom : FIELD.top };
      const dist = Math.hypot(target.x - startPos.x, target.y - startPos.y);
      const speed = dist / Math.max(0.001, FIREBALL_DELAY);
      spawnProjectile({
        owner: player,
        color: color,
        start: startPos,
        targetPos: target,
        speed,
        kind: 'fireball',
      }, null);
      audio.play('fireballCast', { volume: 0.55 });
    }

    updateSpellOptionsForPlayer(player);
    return { ok: true };
  }

  function getFireballTarget(player, targetKey) {
    const dir = player === 'P1' ? -1 : 1;
    if (targetKey === 'left') {
      return { x: LANE_LEFT_X, y: MID_Y + dir * 120 };
    }
    if (targetKey === 'right') {
      return { x: LANE_RIGHT_X, y: MID_Y + dir * 120 };
    }
  if (targetKey === 'king') {
    const enemy = state.towers.find(t => t.owner !== player && t.kind === 'king');
    if (enemy) return { x: enemy.pos.x, y: enemy.pos.y };
    return { x: W/2, y: player === 'P1' ? FIELD.top + 80 : FIELD.bottom - 80 };
  }
  return null;
}

  const AI_CONFIG = {
    easy: {
      decisionRange: [2.6, 3.4],
      cards: ['knight', 'archer', 'goblin'],
      weights: { knight: 3, archer: 2, goblin: 2 },
      fireball: false,
    },
    medium: {
      decisionRange: [1.8, 2.4],
      cards: ['knight', 'archer', 'goblin', 'giant'],
      weights: { knight: 3, archer: 2, goblin: 2, giant: 1.2 },
      fireball: true,
      fireballRange: [8, 12],
      fireballThreshold: 240,
    },
    hard: {
      decisionRange: [1.1, 1.7],
      cards: ['knight', 'archer', 'goblin', 'giant'],
      weights: { knight: 2.6, archer: 2.2, goblin: 2.4, giant: 1.5 },
      fireball: true,
      fireballRange: [5, 8],
      fireballThreshold: 170,
    },
  };

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function createAiState(difficulty) {
    const cfg = AI_CONFIG[difficulty] || AI_CONFIG.medium;
    return {
      difficulty,
      config: cfg,
      decisionTimer: randomRange(cfg.decisionRange[0], cfg.decisionRange[1]),
      fireballTimer: cfg.fireball ? randomRange(cfg.fireballRange[0], cfg.fireballRange[1]) : Infinity,
    };
  }

  function updateAi(dt) {
    const ai = state.ai;
    if (!ai) return;
    const cfg = ai.config;

    ai.decisionTimer -= dt;
    if (ai.decisionTimer <= 0) {
      const acted = aiAttemptAction(ai);
      ai.decisionTimer = randomRange(cfg.decisionRange[0], cfg.decisionRange[1]) + (acted ? 0 : 0.6);
    }

    if (cfg.fireball) {
      ai.fireballTimer -= dt;
      if (ai.fireballTimer <= 0) {
        const casted = aiAttemptFireball(ai);
        ai.fireballTimer = randomRange(cfg.fireballRange[0], cfg.fireballRange[1]) + (casted ? 0 : 2.5);
      }
    }
  }

  function aiAttemptAction(ai) {
    const owner = 'P2';
    const playerState = state.p2;
    const availableCards = ai.config.cards.filter(card => {
      const def = Cards[card];
      if (!def || def.spell) return false;
      if (playerState.mana + 1e-3 < def.cost) return false;
      if ((playerState.cooldowns[card] || 0) > 0) return false;
      if (getUnitCount(owner) >= MAX_UNITS_PER_SIDE && card !== 'fireball') return false;
      return true;
    });
    if (!availableCards.length) return false;

    const card = aiChooseCard(ai, availableCards);
    if (!card) return false;
    const lane = aiChooseLane(ai, owner);
    const spawnY = getAiSpawnY(owner, card);
    const result = spawnUnit(owner, card, lane.x, spawnY);
    if (result.ok) {
      state.p2.selected = card;
      return true;
    }
    return false;
  }

  function aiChooseCard(ai, available) {
    const weights = ai.config.weights || {};
    let total = 0;
    const entries = [];
    for (const card of available) {
      let weight = weights[card] || 1;
      if (card === 'giant') {
        const existingGiants = state.units.filter(u => u.owner === 'P2' && u.type === 'giant').length;
        if (existingGiants > 0) weight *= 0.4;
      }
      total += weight;
      entries.push({ card, weight, total });
    }
    const r = Math.random() * total;
    return entries.find(entry => r <= entry.total)?.card || available[0];
  }

  function aiChooseLane(ai, owner) {
    const enemyOwner = owner === 'P1' ? 'P2' : 'P1';
    const lanes = [
      { name: 'left', x: LANE_LEFT_X },
      { name: 'right', x: LANE_RIGHT_X },
    ];
    let best = lanes[0];
    let bestScore = -Infinity;
    for (const lane of lanes) {
      const friendly = countUnitsInLane(owner, lane.x);
      const enemy = countUnitsInLane(enemyOwner, lane.x);
      const enemyTower = findTower(enemyOwner, lane.name);
      const friendlyTower = findTower(owner, lane.name);
      const enemyTowerHp = enemyTower ? enemyTower.hp : 0;
      const friendlyTowerHp = friendlyTower ? friendlyTower.hp : 0;
      let score = enemy * 3 - friendly * 1.3;
      if (!enemyTower || enemyTower.hp <= 0) score += 40;
      if (enemyTower) score += (1 - enemyTowerHp / SIDE_TOWER_HP) * 40;
      score -= (1 - Math.max(friendlyTowerHp, 1) / SIDE_TOWER_HP) * 20;
      score += Math.random() * 15;
      if (score > bestScore) {
        bestScore = score;
        best = lane;
      }
    }
    return best;
  }

  function findTower(owner, laneName) {
    const laneX = laneName === 'left' ? LANE_LEFT_X : LANE_RIGHT_X;
    return state.towers
      .filter(t => t.owner === owner && t.kind === 'side')
      .find(t => Math.abs(t.pos.x - laneX) < 40);
  }

  function countUnitsInLane(owner, laneX) {
    return state.units.filter(u => u.owner === owner && Math.abs(u.laneX - laneX) < 40).length;
  }

  function getAiSpawnY(owner, cardKey) {
    if (owner === 'P2') {
      const min = FIELD.top + 70;
      const max = Math.max(min + 10, MID_Y - NO_SPAWN_MARGIN - 40);
      if (cardKey === 'giant') return Math.min(max, min + 40);
      return min + Math.random() * (max - min);
    } else {
      const max = FIELD.bottom - 70;
      const min = Math.min(max - 10, MID_Y + NO_SPAWN_MARGIN + 40);
      if (cardKey === 'giant') return Math.max(min, max - 40);
      return min + Math.random() * (max - min);
    }
  }

  function aiAttemptFireball(ai) {
    const owner = 'P2';
    const enemy = 'P1';
    const targets = ['left', 'right', 'king'];
    let bestKey = null;
    let bestScore = -Infinity;
    for (const key of targets) {
      const point = getFireballTarget(owner, key);
      if (!point) continue;
      const score = evaluateFireballTarget(owner, enemy, point);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
    if (!bestKey) return false;
    const threshold = ai.config.fireballThreshold || 200;
    if (bestScore < threshold) return false;
    const result = castSpell(owner, 'fireball', bestKey);
    return result.ok;
  }

  function evaluateFireballTarget(owner, enemyOwner, point) {
    let enemyValue = 0;
    let friendlyPenalty = 0;
    for (const unit of state.units) {
      const dist = Math.hypot(unit.pos.x - point.x, unit.pos.y - point.y);
      if (dist <= FIREBALL_RADIUS) {
        const dmg = Math.min(unit.hp, FIREBALL_UNIT_DAMAGE);
        if (unit.owner === enemyOwner) enemyValue += dmg;
        else if (unit.owner === owner) friendlyPenalty += dmg;
      }
    }
    for (const tower of state.towers) {
      const dist = Math.hypot(tower.pos.x - point.x, tower.pos.y - point.y);
      if (dist <= FIREBALL_RADIUS) {
        const dmg = tower.kind === 'king' ? FIREBALL_KING_DAMAGE : FIREBALL_TOWER_DAMAGE;
        if (tower.owner === enemyOwner) enemyValue += dmg * 1.3;
        else if (tower.owner === owner) friendlyPenalty += dmg * 1.5;
      }
    }
    return enemyValue - friendlyPenalty;
  }

  // Canvas pointer handling
  const activePtrs = new Map(); // id -> {x,y, player}
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const player = y > MID_Y ? 'P1' : 'P2';
    activePtrs.set(e.pointerId, {x,y,player});
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!activePtrs.has(e.pointerId)) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top) * (H / rect.height);
    const p = activePtrs.get(e.pointerId);
    p.x = x; p.y = y;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!activePtrs.has(e.pointerId)) return;
    const p = activePtrs.get(e.pointerId);
    activePtrs.delete(e.pointerId);
    tryPlace(p.player, p.x, p.y);
  });
  canvas.addEventListener('pointercancel', (e) => {
    activePtrs.delete(e.pointerId);
  });

  function tryPlace(player, x, y) {
    if (state.phase !== 'playing') return;
    // Must place on own half
    if (player === 'P1' && y < MID_Y + NO_SPAWN_MARGIN) return;
    if (player === 'P2' && y > MID_Y - NO_SPAWN_MARGIN) return;

    // Snap x to lane
    const laneX = Math.abs(x - LANE_LEFT_X) < Math.abs(x - LANE_RIGHT_X) ? LANE_LEFT_X : LANE_RIGHT_X;

    const card = (player === 'P1' ? state.p1.selected : state.p2.selected) || 'knight';
    const cardDef = Cards[card];
    if (cardDef && cardDef.spell) {
      flashStatus(`${player === 'P1' ? 'Player 1' : 'Player 2'}: Tap a spell target to cast.`);
      return;
    }
    const validation = canSpawn(player, card);
    if (!validation.ok) {
      flashStatus(describeSpawnFailure(player, card, validation));
      return;
    }
    const result = spawnUnit(player, card, laneX, y, validation);
    if (!result.ok) {
      flashStatus(describeSpawnFailure(player, card, result));
    }
    audio.play('spawn', { volume: 0.35 });
  }

  function flashStatus(msg) {
    statusEl.textContent = msg;
    setTimeout(() => { statusEl.textContent = 'Tap a card, then tap your half to deploy.'; }, 900);
  }

  // ---- Simulation ----
  function startMatch(config = gameConfig) {
    const mode = config.mode || 'pvp';
    const difficulty = config.difficulty || 'easy';
    gameConfig.mode = mode;
    gameConfig.difficulty = difficulty;
    state.mode = mode;
    state.difficulty = difficulty;
    state.ai = mode === 'ai' ? createAiState(difficulty) : null;
    // Reset
    state.timeLeft = MATCH_SECONDS;
    state.phase = 'playing';
    state.paused = false;
    state.p1.mana = 5; state.p1.selected = 'knight';
    state.p2.mana = 5; state.p2.selected = mode === 'ai' ? 'knight' : 'knight';
    for (const key of cardKeys) {
      state.p1.cooldowns[key] = 0;
      state.p2.cooldowns[key] = 0;
    }
    state.p1.deployCd = 0;
    state.p2.deployCd = 0;
    state.units = [];
    state.effects = [];
    state.projectiles = [];
    state.spellQueue = [];
    initTowers();
    setActiveCardFor('P1','knight');
    setActiveCardFor('P2','knight');
    updateManaBars();
    updateSpellOptionsForPlayer('P1');
    updateSpellOptionsForPlayer('P2');
    resultTitle.textContent = 'Game Over';
    startOverlay.hidden = true;
    pauseOverlay.hidden = true;
    endOverlay.hidden = true;
    state.lastTick = performance.now();
    ensureLoop();
    fitBoardToViewport();
    if (pauseBtn) pauseBtn.disabled = false;
  }

  function goToMainMenu() {
    state.phase = 'menu';
    state.paused = false;
    stopLoop();
    pauseOverlay.hidden = true;
    endOverlay.hidden = true;
    startOverlay.hidden = false;
    modeInputs.forEach(input => { input.checked = input.value === gameConfig.mode; });
    difficultyInputs.forEach(input => { input.checked = input.value === gameConfig.difficulty; });
    statusEl.textContent = 'Tap a card, then tap your half to deploy.';
    toggleDifficultySection(getSelectedMode());
    fitBoardToViewport();
    if (pauseBtn) pauseBtn.disabled = true;
    state.ai = null;
    state.units = [];
    state.projectiles = [];
    state.spellQueue = [];
    state.timeLeft = MATCH_SECONDS;
    state.mode = gameConfig.mode;
    state.difficulty = gameConfig.difficulty;
    initTowers();
    timeEl.textContent = '03:00';
    state.p1.mana = 5; state.p2.mana = 5;
    updateManaBars();
    render();
  }

  function enterPause() {
    if (state.phase !== 'playing') return;
    state.phase = 'paused';
    state.paused = true;
    pauseOverlay.hidden = false;
    state.lastTick = performance.now();
    ensureLoop();
    if (pauseBtn) pauseBtn.disabled = true;
  }

  function exitPause() {
    if (state.phase !== 'paused') return;
    state.phase = 'playing';
    state.paused = false;
    pauseOverlay.hidden = true;
    state.lastTick = performance.now();
    ensureLoop();
    if (pauseBtn) pauseBtn.disabled = false;
  }

  function ensureLoop() {
    if (loopHandle === null) {
      loopHandle = requestAnimationFrame(loop);
    }
  }

  function stopLoop() {
    if (loopHandle !== null) {
      cancelAnimationFrame(loopHandle);
      loopHandle = null;
    }
  }

  function loop() {
    loopHandle = null;
    const now = performance.now();
    if (state.phase === 'playing') {
      let dt = now - state.lastTick;
      if (dt >= TICK_MS) {
        const steps = Math.min(5, Math.floor(dt / TICK_MS));
        for (let i = 0; i < steps; i++) tick(TICK_MS / 1000);
        state.lastTick += steps * TICK_MS;
      }
    } else {
      state.lastTick = now;
    }
    render();
    if (state.phase === 'playing' || state.phase === 'paused') {
      ensureLoop();
    }
  }

  function tick(dt) {
    // timer
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const t = Math.ceil(state.timeLeft);
    const mm = String(Math.floor(t/60)).padStart(2,'0');
    const ss = String(t%60).padStart(2,'0');
    timeEl.textContent = mm + ':' + ss;
    if (state.timeLeft <= 0 && state.phase === 'playing') {
      // Decide by king HP
      const p1k = state.towers.find(t=>t.id==='P1K').hp;
      const p2k = state.towers.find(t=>t.id==='P2K').hp;
      let winner = 'Tie!';
      if (p1k > p2k) winner = 'Player 1 wins by HP!';
      else if (p2k > p1k) winner = 'Player 2 wins by HP!';
      endGame(winner);
    }

    // mana regen (double last minute)
    const manaRate = state.timeLeft <= (MATCH_SECONDS - DOUBLE_MANA_START) ? 2 : 1;
    state.p1.mana = Math.min(MANA_CAP, state.p1.mana + manaRate * dt);
    state.p2.mana = Math.min(MANA_CAP, state.p2.mana + manaRate * dt);
    for (const k of cardKeys) state.p1.cooldowns[k] = Math.max(0, state.p1.cooldowns[k]-dt);
    for (const k of cardKeys) state.p2.cooldowns[k] = Math.max(0, state.p2.cooldowns[k]-dt);
    state.p1.deployCd = Math.max(0, (state.p1.deployCd || 0) - dt);
    state.p2.deployCd = Math.max(0, (state.p2.deployCd || 0) - dt);

    if (state.mode === 'ai' && state.ai) updateAi(dt);

    // towers acquire & fire
    for (const tw of state.towers) {
      if (tw.hp <= 0) continue;
      tw.cd = Math.max(0, tw.cd - dt);
      if (tw.cd > 0) continue;
      // find target in range
      const enemies = state.units.filter(u => u.owner !== tw.owner && u.hp > 0);
      let best = null, bestDist = 1e9;
      for (const u of enemies) {
        const dx = u.pos.x - tw.pos.x, dy = u.pos.y - tw.pos.y;
        const d = Math.hypot(dx, dy);
        if (d <= tw.range && d < bestDist) { best = u; bestDist = d; }
      }
      const towerColor = tw.owner === 'P1' ? '#6ea8fe' : '#f59e0b';
      if (!best) {
        // try enemy king if in range
        const enemyKing = state.towers.find(t=>t.owner !== tw.owner && t.kind==='king');
        const d = Math.hypot(enemyKing.pos.x - tw.pos.x, enemyKing.pos.y - tw.pos.y);
        if (enemyKing && enemyKing.hp>0 && d<=tw.range) {
          spawnProjectile({
            owner: tw.owner,
            color: towerColor,
            start: { x: tw.pos.x, y: tw.pos.y },
            targetPos: { x: enemyKing.pos.x, y: enemyKing.pos.y },
            speed: 480,
            kind: 'tower',
          }, () => {
            enemyKing.hp -= tw.atk;
            addHitEffect(enemyKing.pos.x, enemyKing.pos.y, towerColor, 26);
            audio.play('kingHit', { volume: 0.45 });
          });
          tw.cd = tw.cadence;
          audio.play('towerShot', { volume: 0.4 });
        }
        continue;
      }
      // fire
      spawnProjectile({
        owner: tw.owner,
        color: towerColor,
        start: { x: tw.pos.x, y: tw.pos.y },
        targetUnit: best,
        speed: 520,
        kind: 'tower',
      }, () => {
        best.hp -= tw.atk;
        addHitEffect(best.pos.x, best.pos.y, towerColor, Math.max(20, best.radius ? best.radius + 6 : 20));
        audio.play('hit', { volume: 0.25 });
      });
      tw.cd = tw.cadence;
      audio.play('towerShot', { volume: 0.35 });
    }

    // units acquire & attack & move
    for (const u of state.units) {
      if (u.hp <= 0) continue;

      // acquire target if needed
      let target = null;
      if (u.targetId) {
        // find existing by id
        target = state.units.find(x=>x.id===u.targetId && x.hp>0);
        if (!target) {
          const allTw = state.towers.find(t=>t.id===u.targetId && t.hp>0);
          if (allTw) target = allTw;
          else {
            u.targetId = null; u.targetType = null;
          }
        }
      }

      // Prefer enemy units that are already within striking range to block progress
      if (u.targetsUnits !== false) {
        let unitCandidate = null, unitDist = 1e9;
        for (const e of state.units) {
          if (e.owner === u.owner || e.hp <= 0) continue;
          const dx = e.pos.x - u.pos.x;
          const dy = e.pos.y - u.pos.y;
          const dist = Math.hypot(dx, dy);
          const engageRange = u.melee ? (u.radius + e.radius + 2) : u.range;
          if (dist > engageRange) continue;
          if (dist < unitDist) { unitCandidate = e; unitDist = dist; }
        }
        if (unitCandidate) {
          u.targetId = unitCandidate.id;
          u.targetType = 'unit';
          target = unitCandidate;
        }
      }

      if (!target && u.targetsBuildings !== false) {
        // choose a tower/king in lane directionally (closest ahead)
        const enemyTowers = state.towers.filter(t=>t.owner !== u.owner && t.hp>0);
        let best = null, bestD = 1e9;
        for (const tw of enemyTowers) {
          // prefer same-lane x
          if (Math.abs(tw.pos.x - u.laneX) > 60) continue;
          const dx = tw.pos.x - u.pos.x, dy = tw.pos.y - u.pos.y;
          // ahead means sign(dy) equals u.facing (-1 for P1 moving up)
          if (Math.sign(dy) !== u.facing) continue;
          const dist = Math.hypot(dx, dy);
          if (dist < bestD) { best = tw; bestD = dist; }
        }
        if (!best) {
          // fallback to king
          const king = state.towers.find(t=>t.owner !== u.owner && t.kind==='king' && t.hp>0);
          if (king) { best = king; }
        }
        if (best) { u.targetId = best.id; u.targetType = 'tower'; target = best; }
      }

      // attack if in range
      u.atkCd = Math.max(0, u.atkCd - dt);
      let inRange = false;
      if (target) {
        const dist = Math.hypot(target.pos.x - u.pos.x, target.pos.y - u.pos.y);
        const meleeRange = u.radius + (target.radius || 16) + 2;
        inRange = u.melee ? (dist <= meleeRange) : (dist <= u.range);
        if (inRange && u.atkCd === 0) {
          u.atkCd = u.atkInterval;
          const hitColor = u.owner === 'P1' ? '#6ea8fe' : '#f59e0b';
          const finalizeHit = () => {
            target.hp -= u.dps * dt; // using dps * dt gives smooth damage; could quantize
            const splashRadius = u.melee ? Math.max(18, (target.radius || 16) + 4) : 24;
            const targetPos = target.pos || { x: u.pos.x, y: u.pos.y };
            addHitEffect(targetPos.x, targetPos.y, hitColor, splashRadius);
            if (target.kind === 'king') {
              audio.play('kingHit', { volume: 0.45 });
            } else {
              audio.play('hit', { volume: u.melee ? 0.25 : 0.15 });
            }
          };
          if (!u.melee) {
            spawnProjectile({
              owner: u.owner,
              color: hitColor,
              start: { x: u.pos.x, y: u.pos.y },
              targetUnit: target,
              speed: 540,
              kind: 'arrow',
            }, finalizeHit);
          } else {
            finalizeHit();
          }
        }
      }

      // Movement: only advance when pursuing a target
      const speed = u.speed;
      // Drift toward target horizontally when appropriate
      let desiredX = u.laneX;
      if (target && target.pos) {
        if (u.targetType === 'unit') {
          desiredX = target.pos.x;
        } else {
          const crossedRiver = u.owner === 'P1' ? (u.pos.y <= RIVER_Y - 8) : (u.pos.y >= RIVER_Y + 8);
          if (crossedRiver) {
            desiredX = target.pos.x;
          }
        }
      }
      const dx = desiredX - u.pos.x;
      if (Math.abs(dx) > 0.1) {
        const maxStep = 90 * dt;
        u.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), maxStep);
      }

      const shouldAdvance = (target && !inRange) || (!target && u.targetsBuildings !== false);
      if (shouldAdvance) {
        let dir = u.facing;
        if (target && target.pos) {
          const dy = target.pos.y - u.pos.y;
          dir = Math.sign(dy) || u.facing;
        }
        u.pos.y += dir * speed * dt;
      }
    }

    updateSpells(dt);

    // cull dead units
    state.units = state.units.filter(u => u.hp > 0);

    // check king death
    const P1K = state.towers.find(t=>t.id==='P1K');
    const P2K = state.towers.find(t=>t.id==='P2K');
    if (P1K.hp <= 0) endGame('Player 2 destroys the King!');
    if (P2K.hp <= 0) endGame('Player 1 destroys the King!');

    updateManaBars();
    updateEffects(dt);
  }

  function endGame(result) {
    state.phase = 'ended';
    state.paused = false;
    resultTitle.textContent = result;
    endOverlay.hidden = false;
    pauseOverlay.hidden = true;
    audio.play('victory', { volume: 0.35 });
    if (pauseBtn) pauseBtn.disabled = true;
  }

  // ---- Rendering ----
  function render() {
    // bg
    ctx.clearRect(0,0,W,H);
    drawField();
    drawPlacementLocks();
    drawTowers();
    drawUnits();
    drawEffects();
    drawGhosts();
  }

  function drawField() {
    // sides
    ctx.fillStyle = '#0e1430';
    ctx.fillRect(0,0,W,H);
    // river
    ctx.fillStyle = '#143a66';
    ctx.fillRect(FIELD.left, RIVER_Y-18, FIELD.right-FIELD.left, 36);
    // bridges
    drawBridge(LANE_LEFT_X, RIVER_Y-18, 64, 36);
    drawBridge(LANE_RIGHT_X, RIVER_Y-18, 64, 36);

    // lane guides (subtle)
    ctx.setLineDash([4,8]);
    ctx.strokeStyle = '#233055';
    ctx.beginPath();
    ctx.moveTo(LANE_LEFT_X, FIELD.top); ctx.lineTo(LANE_LEFT_X, FIELD.bottom);
    ctx.moveTo(LANE_RIGHT_X, FIELD.top); ctx.lineTo(LANE_RIGHT_X, FIELD.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // midline
    ctx.strokeStyle = '#1c284a';
    ctx.beginPath(); ctx.moveTo(FIELD.left, MID_Y); ctx.lineTo(FIELD.right, MID_Y); ctx.stroke();
  }

  function drawPlacementLocks() {
    if (state.phase !== 'playing') return;
    const bottomLocked = (state.p1.deployCd || 0) > 0 || getUnitCount('P1') >= MAX_UNITS_PER_SIDE;
    const topLocked = (state.p2.deployCd || 0) > 0 || getUnitCount('P2') >= MAX_UNITS_PER_SIDE;
    if (topLocked) {
      ctx.save();
      ctx.fillStyle = 'rgba(245,158,11,0.08)';
      ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, MID_Y - FIELD.top);
      ctx.restore();
    }
    if (bottomLocked) {
      ctx.save();
      ctx.fillStyle = 'rgba(110,168,254,0.08)';
      ctx.fillRect(FIELD.left, MID_Y, FIELD.right - FIELD.left, FIELD.bottom - MID_Y);
      ctx.restore();
    }
  }

  function drawBridge(cx, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#8b6b44';
    ctx.strokeStyle = '#6a5033';
    ctx.lineWidth = 2;
    ctx.translate(cx, y);
    ctx.beginPath();
    ctx.rect(-w/2, 0, w, h);
    ctx.fill(); ctx.stroke();
    // planks
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    for (let i=0;i<6;i++) { ctx.beginPath(); ctx.moveTo(-w/2+ i*(w/6), 0); ctx.lineTo(-w/2+ i*(w/6), h); ctx.stroke(); }
    ctx.restore();
  }

  function drawTowers() {
    for (const t of state.towers) {
      const dead = t.hp <= 0;
      const color = t.owner === 'P1' ? '#6ea8fe' : '#f59e0b';
      ctx.save();
      ctx.translate(t.pos.x, t.pos.y);
      // body
      ctx.fillStyle = dead ? '#2a314f' : '#121932';
      ctx.strokeStyle = dead ? '#2a314f' : color;
      ctx.lineWidth = 2;
      const w = t.kind === 'king' ? 54 : 36;
      const h = t.kind === 'king' ? 40 : 28;
      ctx.beginPath();
      ctx.rect(-w/2, -h/2, w, h);
      ctx.fill(); ctx.stroke();

      // muzzle / crown
      ctx.fillStyle = color;
      if (t.kind === 'king') {
        ctx.fillRect(-12, -h/2-6, 24, 6);
      } else {
        ctx.fillRect(-8, -h/2-4, 16, 4);
      }

      // HP bar
      const maxHp = t.kind==='king' ? KING_HP : SIDE_TOWER_HP;
      const pct = Math.max(0, t.hp / maxHp);
      const barW = w, barH = 5;
      ctx.fillStyle = '#1a2344'; ctx.fillRect(-barW/2, h/2+6, barW, barH);
      ctx.fillStyle = color; ctx.fillRect(-barW/2, h/2+6, barW*pct, barH);
      ctx.restore();
    }
  }

  function drawUnits() {
    for (const u of state.units) {
      const color = u.owner === 'P1' ? '#6ea8fe' : '#f59e0b';
      ctx.save();
      ctx.translate(u.pos.x, u.pos.y);
      // body
      ctx.beginPath();
      ctx.arc(0,0,u.radius,0,Math.PI*2);
      ctx.fillStyle = '#121932';
      ctx.fill(); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke();

      // type marker
      ctx.fillStyle = color;
      if (u.type==='knight') {
        ctx.fillRect(-6,-12,12,4);
      } else if (u.type==='archer') {
        ctx.beginPath();
        ctx.moveTo(-8,0); ctx.lineTo(0,-8); ctx.lineTo(8,0); ctx.closePath(); ctx.fill();
      } else if (u.type==='goblin') {
        ctx.beginPath();
        ctx.moveTo(-10,-4); ctx.lineTo(0,-12); ctx.lineTo(10,-4); ctx.closePath(); ctx.fill();
      } else if (u.type==='giant') {
        ctx.fillRect(-10,-8,20,6);
      }

      // hp bar
      const maxHp = Cards[u.type].hp;
      const pct = Math.max(0, u.hp / maxHp);
      ctx.fillStyle = '#1a2344'; ctx.fillRect(-14, 16, 28, 5);
      ctx.fillStyle = color; ctx.fillRect(-14, 16, 28*pct, 5);
      ctx.restore();
    }
  }

  function updateSpells(dt) {
    if (!state.spellQueue.length) return;
    for (const spell of state.spellQueue) spell.timer -= dt;
    const ready = state.spellQueue.filter(spell => spell.timer <= 0);
    state.spellQueue = state.spellQueue.filter(spell => spell.timer > 0);
    for (const spell of ready) {
      if (spell.type === 'fireball') resolveFireball(spell);
    }
  }

  function resolveFireball(spell) {
    const center = spell.target;
    const radius = spell.radius;
    const color = '#f97316';
    addHitEffect(center.x, center.y, color, radius + 40);
    state.effects.push({ kind: 'telegraph', x: center.x, y: center.y, radius: radius * 0.6, life: 0.25, maxLife: 0.25, color: '#facc15' });
    for (const u of state.units) {
      const dist = Math.hypot(u.pos.x - center.x, u.pos.y - center.y);
      if (dist <= radius) {
        u.hp -= FIREBALL_UNIT_DAMAGE;
      }
    }
    for (const tw of state.towers) {
      const dist = Math.hypot(tw.pos.x - center.x, tw.pos.y - center.y);
      if (dist <= radius) {
        const dmg = tw.kind === 'king' ? FIREBALL_KING_DAMAGE : FIREBALL_TOWER_DAMAGE;
        tw.hp = Math.max(0, tw.hp - dmg);
      }
    }
    audio.play('fireballImpact', { volume: 0.65 });
  }

  function updateEffects(dt) {
    for (const fx of state.effects) {
      fx.life = Math.max(0, fx.life - dt);
    }
    state.effects = state.effects.filter(fx => fx.life > 0);
    for (const proj of state.projectiles) {
      if (proj.followUnit) {
        if (proj.followUnit.hp > 0) {
          proj.targetPos.x = proj.followUnit.pos.x;
          proj.targetPos.y = proj.followUnit.pos.y;
        }
      }
      const increment = proj.travelTime > 0 ? (dt / proj.travelTime) : 1;
      proj.progress = Math.min(1, proj.progress + increment);
    }
    const finished = state.projectiles.filter(p => p.progress >= 1);
    state.projectiles = state.projectiles.filter(p => p.progress < 1);
    finished.forEach(p => p.onImpact && p.onImpact());
  }

  function drawEffects() {
    for (const fx of state.effects) {
      const alpha = Math.max(0, fx.life / fx.maxLife);
      if (alpha <= 0) continue;
      const kind = fx.kind || 'burst';
      ctx.save();
      ctx.globalAlpha = alpha;
      if (kind === 'telegraph') {
        const stroke = fx.color || '#f97316';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius * 0.55, 0, Math.PI*2);
        ctx.stroke();
      } else {
        const radius = fx.radius * (1 + (1 - alpha) * 0.4);
        const gradient = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, radius);
        gradient.addColorStop(0, fx.color);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const proj of state.projectiles) {
      const t = proj.progress;
      const ease = t * (2 - t); // ease out
      const x = proj.start.x + (proj.targetPos.x - proj.start.x) * ease;
      const y = proj.start.y + (proj.targetPos.y - proj.start.y) * ease;
      const alpha = Math.max(0.15, 1 - t);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(proj.targetPos.y - proj.start.y, proj.targetPos.x - proj.start.x));
      ctx.fillStyle = proj.color;
      if (proj.kind === 'tower') {
        ctx.fillRect(-8, -2, 16, 4);
      } else if (proj.kind === 'fireball') {
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fillStyle = '#fde68a';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-6, -3); ctx.lineTo(6, 0); ctx.lineTo(-6, 3); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawGhosts() {
    // show placement ghost for active pointers
    activePtrs.forEach(ptr => {
      const {x,y,player} = ptr;
      // Valid?
      let reason = null;
      if (player === 'P1' && y < MID_Y + NO_SPAWN_MARGIN) reason = 'zone';
      if (player === 'P2' && y > MID_Y - NO_SPAWN_MARGIN) reason = 'zone';
      const cardKey = player === 'P1' ? (state.p1.selected || 'knight') : (state.p2.selected || 'knight');
      const card = Cards[cardKey] || Cards.knight;
      const laneX = Math.abs(x - LANE_LEFT_X) < Math.abs(x - LANE_RIGHT_X) ? LANE_LEFT_X : LANE_RIGHT_X;
      if (!reason) {
        const check = canSpawn(player, cardKey);
        if (!check.ok) reason = check.reason;
      }

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      const ghostRadius = card?.radius || 14;
      ctx.arc(laneX, y, ghostRadius, 0, Math.PI*2);
      let fillStyle;
      if (!reason) {
        fillStyle = player === 'P1' ? '#6ea8fe55' : '#f59e0b55';
      } else {
        switch (reason) {
          case 'mana': fillStyle = 'rgba(239,68,68,0.62)'; break;
          case 'card_cd': fillStyle = 'rgba(148,163,184,0.62)'; break;
          case 'deploy_cd': fillStyle = 'rgba(71,85,105,0.6)'; break;
          case 'unit_cap': fillStyle = 'rgba(250,204,21,0.62)'; break;
          default: fillStyle = '#ef444455'; break;
        }
      }
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = reason ? 'rgba(15,23,42,0.8)' : (player==='P1' ? '#6ea8fe' : '#f59e0b');
      ctx.stroke();
      if (reason) {
        const label = (() => {
          switch (reason) {
            case 'mana': return 'Need mana';
            case 'card_cd': return 'Cooldown';
            case 'deploy_cd': return 'Deploy cooldown';
            case 'unit_cap': return 'Unit cap';
            case 'zone': return 'Invalid area';
            default: return '';
          }
        })();
        if (label) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = '#e8ecff';
          ctx.font = '14px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, laneX, y - ghostRadius - 8);
        }
      }
      ctx.restore();
    });
  }

  // Initialize
  setActiveCardFor('P1','knight');
  setActiveCardFor('P2','knight');
  updateManaBars();
  initTowers();
  fitBoardToViewport();
  render();

  function fitBoardToViewport() {
    const isCompact = window.innerWidth <= 640;
    const marginX = isCompact ? 12 : 32;
    const bufferY = isCompact ? 16 : 28;
    const topRect = handP2 ? handP2.getBoundingClientRect() : null;
    const bottomRect = handP1 ? handP1.getBoundingClientRect() : null;
    const topHeight = topRect ? topRect.height : 0;
    const bottomHeight = bottomRect ? bottomRect.height : 0;

    const availW = Math.max(240, window.innerWidth - marginX);
    const topBound = topHeight + bufferY;
    const bottomBound = window.innerHeight - bottomHeight - bufferY;
    const availableHeight = Math.max(isCompact ? 260 : 360, bottomBound - topBound);
    const scaleX = availW / W;
    const scaleY = availableHeight / H;
    const scale = Math.min(1, scaleX, scaleY);

    const scaledH = H * scale;
    const windowCenter = window.innerHeight / 2;
    let offset = bottomBound - (windowCenter + scaledH / 2);

    let topEdge = windowCenter + offset - scaledH / 2;
    if (topEdge < topBound) {
      offset += (topBound - topEdge);
      topEdge = topBound;
    }
    let bottomEdge = windowCenter + offset + scaledH / 2;
    if (bottomEdge > bottomBound) {
      offset -= (bottomEdge - bottomBound);
    }

    const translateBeforeScale = scale === 0 ? 0 : offset / scale;
    canvas.style.transform = `translateY(${translateBeforeScale}px) scale(${scale})`;
    canvas.dataset.scale = scale.toFixed(3);
  }

  window.addEventListener('resize', fitBoardToViewport);

  // Show start overlay initially (audio unlock if you add sounds later)
  // Do not auto-start; wait for user gesture
})();
