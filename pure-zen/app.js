const SELECTORS = {
  app: '.app',
  startBtn: '.start-btn',
  summaryLength: '[data-summary="length"]',
  summaryTechnique: '[data-summary="technique"]',
  chips: '.chip',
  sheetTrigger: '[data-sheet] ',
  sheets: '.sheet',
  sheetBackdrop: '.sheet__backdrop',
  sliderValue: '[data-slider-value]',
  slider: '[data-length-slider]',
  techniqueRadios: 'input[name="technique"]',
  toggles: '[data-setting]',
  screenSections: '.screen',
  time: '[data-time]',
  phase: '[data-phase]',
  live: '[data-live]',
  progress: '.progress-ring__progress',
  breathCircle: '.breath-circle',
  pauseBtn: '[data-action="pause"]',
  endBtn: '[data-action="end"]',
  soundBtn: '[data-action="sound"]',
  streak: '[data-streak]'
};

const TECHNIQUES = {
  coherent: [
    { phase: 'inhale', seconds: 5 },
    { phase: 'exhale', seconds: 5 }
  ],
  box: [
    { phase: 'inhale', seconds: 4 },
    { phase: 'hold', seconds: 4 },
    { phase: 'exhale', seconds: 4 },
    { phase: 'hold', seconds: 4 }
  ],
  '478': [
    { phase: 'inhale', seconds: 4 },
    { phase: 'hold', seconds: 7 },
    { phase: 'exhale', seconds: 8 }
  ]
};

const DEFAULT_SETTINGS = {
  lengthMinutes: 5,
  technique: 'coherent',
  sound: false,
  haptics: true,
  lang: 'en'
};

const STORAGE_KEYS = {
  settings: 'pz.settings',
  streak: 'pz.streak'
};

const TRANSLATIONS = {
  en: {
    tagline: 'Calm breathing. No hurry, no pause.',
    startLabel: 'Start {minutes}-minute session',
    changeLength: 'Change length',
    technique: 'Technique',
    length: 'Length',
    pause: 'Pause',
    resume: 'Resume',
    end: 'End',
    done: 'Done. Nice work.',
    restart: 'Restart',
    home: 'Home',
    sound: 'Sound',
    haptics: 'Haptics',
    language: 'Language',
    doneButton: 'Done',
    coherentInfo: 'Inhale 5s · Exhale 5s',
    boxInfo: 'Inhale 4s · Hold 4s · Exhale 4s · Hold 4s',
    '478Info': 'Inhale 4s · Hold 7s · Exhale 8s',
    inhale: 'Inhale',
    hold: 'Hold',
    exhale: 'Exhale',
    phaseAnnouncement: {
      inhale: 'Inhale for {seconds} seconds…',
      hold: 'Hold for {seconds} seconds…',
      exhale: 'Exhale for {seconds} seconds…'
    },
    streak: (current, best) => `Current streak: ${current} days${best ? ` (best ${best})` : ''}`
  },
  it: {
    tagline: 'Respira con calma. Senza fretta, senza pausa.',
    startLabel: 'Avvia sessione da {minutes} minuti',
    changeLength: 'Cambia durata',
    technique: 'Tecnica',
    length: 'Durata',
    pause: 'Pausa',
    resume: 'Riprendi',
    end: 'Fine',
    done: 'Fatto. Ottimo.',
    restart: 'Ricomincia',
    home: 'Home',
    sound: 'Suono',
    haptics: 'Feedback',
    language: 'Lingua',
    doneButton: 'Fatto',
    coherentInfo: 'Inspira 5s · Espira 5s',
    boxInfo: 'Inspira 4s · Pausa 4s · Espira 4s · Pausa 4s',
    '478Info': 'Inspira 4s · Pausa 7s · Espira 8s',
    inhale: 'Inspira',
    hold: 'Pausa',
    exhale: 'Espira',
    phaseAnnouncement: {
      inhale: 'Inspira per {seconds} secondi…',
      hold: 'Pausa per {seconds} secondi…',
      exhale: 'Espira per {seconds} secondi…'
    },
    streak: (current, best) => `Serie attuale: ${current} giorni${best ? ` (record ${best})` : ''}`
  },
  ru: {
    tagline: 'Спокойное дыхание. Без спешки, без пауз.',
    startLabel: 'Старт, {minutes} мин',
    changeLength: 'Изменить длительность',
    technique: 'Техника',
    length: 'Длительность',
    pause: 'Пауза',
    resume: 'Продолжить',
    end: 'Завершить',
    done: 'Готово. Отлично.',
    restart: 'Снова',
    home: 'Домой',
    sound: 'Звук',
    haptics: 'Вибрация',
    language: 'Язык',
    doneButton: 'Готово',
    coherentInfo: 'Вдох 5с · Выдох 5с',
    boxInfo: 'Вдох 4с · Пауза 4с · Выдох 4с · Пауза 4с',
    '478Info': 'Вдох 4с · Пауза 7с · Выдох 8с',
    inhale: 'Вдох',
    hold: 'Задержка',
    exhale: 'Выдох',
    phaseAnnouncement: {
      inhale: 'Вдох на {seconds} секунд…',
      hold: 'Задержка на {seconds} секунд…',
      exhale: 'Выдох на {seconds} секунд…'
    },
    streak: (current, best) => `Серия: ${current} дн.${best ? ` (лучшее ${best})` : ''}`
  }
};

const TECH_LABELS = {
  coherent: 'Coherent (5-5)',
  box: 'Box (4-4-4-4)',
  '478': '4-7-8'
};

const CIRCUMFERENCE = 2 * Math.PI * 54;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let audioContext;

function loadSettings() {
  const stored = localStorage.getItem(STORAGE_KEYS.settings);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch (error) {
    console.warn('Failed to parse settings', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function loadStreak() {
  const stored = localStorage.getItem(STORAGE_KEYS.streak);
  if (!stored) {
    return {
      lastCompletionISO: null,
      currentStreakDays: 0,
      bestStreakDays: 0
    };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      lastCompletionISO: parsed.lastCompletionISO ?? null,
      currentStreakDays: parsed.currentStreakDays ?? 0,
      bestStreakDays: parsed.bestStreakDays ?? 0
    };
  } catch (error) {
    console.warn('Failed to parse streak', error);
    return {
      lastCompletionISO: null,
      currentStreakDays: 0,
      bestStreakDays: 0
    };
  }
}

function saveStreak(streak) {
  localStorage.setItem(STORAGE_KEYS.streak, JSON.stringify(streak));
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${secs}`;
}

function buildPhaseTimeline(totalSeconds, steps) {
  const timeline = [];
  let remaining = totalSeconds;
  let i = 0;
  while (remaining > 0) {
    const step = steps[i % steps.length];
    const duration = Math.min(step.seconds, remaining);
    timeline.push({ phase: step.phase, duration });
    remaining -= duration;
    i += 1;
  }
  return timeline;
}

function createAnnouncement(lang, phase, seconds) {
  const dictionary = TRANSLATIONS[lang].phaseAnnouncement;
  const template = dictionary[phase] || '';
  return template.replace('{seconds}', seconds);
}

function handleHaptics(settings) {
  if (!settings.haptics) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
  }
}

async function playBell(settings) {
  if (!settings.sound) return;
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const duration = 0.5;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(660, now);

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.warn('Sound playback failed', error);
  }
}

class CalmaApp {
  constructor() {
    this.settings = loadSettings();
    this.streak = loadStreak();
    this.elements = this.getElements();
    this.session = null;
    this.isPaused = false;
    this.lastTick = null;
    this.remainingSeconds = 0;
    this.totalSeconds = 0;
    this.timeline = [];
    this.timelineIndex = 0;
    this.timelineElapsed = 0;

    if (this.elements.progress) {
      this.elements.progress.style.strokeDasharray = CIRCUMFERENCE;
      this.elements.progress.style.strokeDashoffset = CIRCUMFERENCE;
    }

    this.bindEvents();
    this.applyLanguage();
    this.updateUI();
    this.applyMotionPreference(prefersReducedMotion.matches);

    prefersReducedMotion.addEventListener('change', (event) => {
      this.applyMotionPreference(event.matches);
    });
  }

  getElements() {
    const scope = document;
    return {
      app: scope.querySelector(SELECTORS.app),
      startBtn: scope.querySelector(SELECTORS.startBtn),
      summaryLength: scope.querySelector(SELECTORS.summaryLength),
      summaryTechnique: scope.querySelector(SELECTORS.summaryTechnique),
      chips: Array.from(scope.querySelectorAll(SELECTORS.chips)),
      sliderValue: scope.querySelector(SELECTORS.sliderValue),
      slider: scope.querySelector(SELECTORS.slider),
      techniqueRadios: Array.from(scope.querySelectorAll(SELECTORS.techniqueRadios)),
      toggleInputs: Array.from(scope.querySelectorAll(SELECTORS.toggles)),
      liveRegion: scope.querySelector(SELECTORS.live),
      time: scope.querySelector(SELECTORS.time),
      phase: scope.querySelector(SELECTORS.phase),
      progress: scope.querySelector(SELECTORS.progress),
      breathCircle: scope.querySelector(SELECTORS.breathCircle),
      pauseBtn: scope.querySelector(SELECTORS.pauseBtn),
      endBtn: scope.querySelector(SELECTORS.endBtn),
      soundBtn: scope.querySelector(SELECTORS.soundBtn),
      sheets: Array.from(scope.querySelectorAll(SELECTORS.sheets)),
      sheetBackdrop: scope.querySelector(SELECTORS.sheetBackdrop),
      streak: scope.querySelector(SELECTORS.streak)
    };
  }

  bindEvents() {
    this.elements.startBtn.addEventListener('click', () => this.startSession());

    document.addEventListener('click', (event) => {
      const sheetTrigger = event.target.closest('[data-sheet]');
      if (sheetTrigger) {
        const id = sheetTrigger.getAttribute('data-sheet');
        this.openSheet(id);
      }

      const closeAction = event.target.closest('[data-action="close-sheet"]');
      if (closeAction) {
        this.closeSheets();
      }

      const chip = event.target.closest('.chip');
      if (chip) {
        const minutes = Number(chip.getAttribute('data-length'));
        if (!Number.isNaN(minutes)) {
          this.updateSettings({ lengthMinutes: minutes });
        }
      }

      const homeAction = event.target.closest('[data-action="home"]');
      if (homeAction) {
        this.stopSession();
        this.showScreen('home');
      }

      const restartAction = event.target.closest('[data-action="restart"]');
      if (restartAction) {
        this.startSession();
      }

      const soundToggle = event.target.closest('[data-action="sound"]');
      if (soundToggle) {
        const pressed = soundToggle.getAttribute('aria-pressed') === 'true';
        this.updateSettings({ sound: !pressed });
      }
    });

    this.elements.sheetBackdrop.addEventListener('click', () => this.closeSheets());

    this.elements.slider.addEventListener('input', (event) => {
      const minutes = Number(event.target.value);
      this.elements.sliderValue.textContent = minutes;
    });

    this.elements.slider.addEventListener('change', (event) => {
      const minutes = Number(event.target.value);
      this.updateSettings({ lengthMinutes: minutes });
    });

    this.elements.techniqueRadios.forEach((radio) => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) {
          this.updateSettings({ technique: event.target.value });
        }
      });
    });

    this.elements.toggleInputs.forEach((input) => {
      const setting = input.getAttribute('data-setting');
      if (!setting) return;
      input.addEventListener('change', (event) => {
        const value = input.type === 'checkbox' ? event.target.checked : event.target.value;
        this.updateSettings({ [setting]: value });
      });
    });

    this.elements.pauseBtn.addEventListener('click', () => {
      if (!this.session) return;
      if (this.isPaused) {
        this.resumeSession();
      } else {
        this.pauseSession();
      }
    });

    this.elements.endBtn.addEventListener('click', () => {
      this.completeSession(false);
    });
  }

  applyLanguage() {
    const { lang } = this.settings;
    const dict = TRANSLATIONS[lang];
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.getAttribute('data-i18n');
      if (dict[key]) {
        node.textContent = dict[key];
      }
    });

    document.querySelectorAll('[data-i18n-text]').forEach((node) => {
      const key = node.getAttribute('data-i18n-text');
      if (dict[key]) {
        node.textContent = dict[key].replace('{minutes}', this.settings.lengthMinutes);
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.getAttribute('data-i18n-placeholder');
      if (dict[key]) {
        node.setAttribute('placeholder', dict[key]);
      }
    });

    this.elements.techniqueRadios.forEach((radio) => {
      const labelInfo = radio.nextElementSibling?.querySelector('small');
      if (!labelInfo) return;
      const infoKey = `${radio.value}Info`;
      if (dict[infoKey]) {
        labelInfo.textContent = dict[infoKey];
      }
    });

    this.updateStartButton();
    this.updatePhaseLabel();
    this.updateStreakMessage();
    this.setPauseButtonLabel();
    this.elements.sliderValue.textContent = this.settings.lengthMinutes;
    this.elements.toggleInputs.forEach((input) => {
      if (input.getAttribute('data-setting') === 'lang') {
        input.value = lang;
      }
    });
  }

  applyMotionPreference(isReduced) {
    if (isReduced) {
      this.elements.breathCircle.style.transform = 'scale(1)';
      this.elements.breathCircle.style.transition = 'none';
    } else {
      this.elements.breathCircle.style.transition = '';
    }
  }

  updateUI() {
    this.updateChips();
    this.updateSummary();
    this.updateStartButton();
    this.updateSheetControls();
    this.updateSoundButton();
    this.updateStreakMessage();
    this.setPauseButtonLabel();
  }

  updateChips() {
    document.querySelectorAll('.chip').forEach((chip) => {
      const value = Number(chip.getAttribute('data-length'));
      chip.classList.toggle('is-active', value === this.settings.lengthMinutes);
    });
  }

  updateSummary() {
    this.elements.summaryLength.textContent = `${this.settings.lengthMinutes} min`;
    this.elements.summaryTechnique.textContent = TECH_LABELS[this.settings.technique];
  }

  updateStartButton() {
    const dict = TRANSLATIONS[this.settings.lang];
    const label = dict.startLabel || TRANSLATIONS.en.startLabel;
    this.elements.startBtn.textContent = label.replace('{minutes}', this.settings.lengthMinutes);
  }

  updateSheetControls() {
    this.elements.slider.value = this.settings.lengthMinutes;
    this.elements.sliderValue.textContent = this.settings.lengthMinutes;

    this.elements.techniqueRadios.forEach((radio) => {
      radio.checked = radio.value === this.settings.technique;
    });

    this.elements.toggleInputs.forEach((input) => {
      const setting = input.getAttribute('data-setting');
      if (setting === 'lang') {
        input.value = this.settings.lang;
      } else if (input.type === 'checkbox') {
        input.checked = Boolean(this.settings[setting]);
      }
    });
  }

  updateSoundButton() {
    this.elements.soundBtn.setAttribute('aria-pressed', this.settings.sound ? 'true' : 'false');
  }

  openSheet(id) {
    const sheet = this.elements.sheets.find((el) => el.getAttribute('data-sheet-id') === id);
    if (!sheet) return;
    sheet.classList.add('is-active');
    this.elements.sheetBackdrop.classList.add('is-active');
    this.elements.sheetBackdrop.hidden = false;
  }

  closeSheets() {
    this.elements.sheets.forEach((sheet) => sheet.classList.remove('is-active'));
    this.elements.sheetBackdrop.classList.remove('is-active');
    this.elements.sheetBackdrop.hidden = true;
  }

  updateSettings(partial) {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
    this.applyLanguage();
    this.updateUI();
  }

  showScreen(id) {
    this.elements.app.setAttribute('data-screen', id);
  }

  startSession() {
    this.closeSheets();
    this.showScreen('session');
    this.isPaused = false;
    this.totalSeconds = this.settings.lengthMinutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.timeline = buildPhaseTimeline(this.totalSeconds, TECHNIQUES[this.settings.technique]);
    this.timelineIndex = 0;
    this.timelineElapsed = 0;
    this.lastTick = null;
    this.session = true;
    this.setPauseButtonLabel();
    this.elements.time.textContent = formatTime(this.remainingSeconds);
    this.updatePhaseLabel();
    this.updateProgress();
    this.schedulePhaseCue();
    this.updateBreathCircle('start');
    playBell(this.settings);

    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  pauseSession() {
    this.isPaused = true;
    this.setPauseButtonLabel();
  }

  resumeSession() {
    this.isPaused = false;
    this.setPauseButtonLabel();
    this.lastTick = null;
    this.rafId = requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  stopSession() {
    cancelAnimationFrame(this.rafId);
    this.session = null;
  }

  updateProgress() {
    const offset = CIRCUMFERENCE * (this.remainingSeconds / this.totalSeconds);
    this.elements.progress.style.strokeDashoffset = offset;
    this.elements.time.textContent = formatTime(this.remainingSeconds);
  }

  updatePhaseLabel() {
    if (!this.timeline.length) {
      this.elements.phase.textContent = TRANSLATIONS[this.settings.lang].inhale;
      return;
    }
    const current = this.timeline[this.timelineIndex] || this.timeline[this.timeline.length - 1];
    this.elements.phase.textContent = TRANSLATIONS[this.settings.lang][current.phase];
  }

  schedulePhaseCue() {
    const current = this.timeline[this.timelineIndex];
    if (!current) return;
    const message = createAnnouncement(this.settings.lang, current.phase, current.duration);
    if (message) {
      this.elements.liveRegion.textContent = message;
    }
    handleHaptics(this.settings);
    this.updatePhaseLabel();
    this.updateBreathCircle(current.phase, current.duration);
  }

  updateBreathCircle(phase, duration = 0) {
    if (prefersReducedMotion.matches) return;
    const circle = this.elements.breathCircle;
    if (phase === 'inhale' || phase === 'start') {
      circle.style.transitionDuration = `${duration || 3}s`;
      circle.style.transform = 'scale(1.08)';
    } else if (phase === 'hold') {
      circle.style.transitionDuration = '0.2s';
      circle.style.transform = 'scale(1.08)';
    } else if (phase === 'exhale') {
      circle.style.transitionDuration = `${duration || 3}s`;
      circle.style.transform = 'scale(0.9)';
    }
  }

  tick(timestamp) {
    if (!this.session) return;
    if (this.isPaused) {
      this.rafId = requestAnimationFrame((t) => this.tick(t));
      return;
    }

    if (!this.lastTick) {
      this.lastTick = timestamp;
    }

    let delta = (timestamp - this.lastTick) / 1000;
    this.lastTick = timestamp;

    this.remainingSeconds = Math.max(this.remainingSeconds - delta, 0);

    while (delta > 0 && this.timelineIndex < this.timeline.length) {
      const currentSegment = this.timeline[this.timelineIndex];
      const remainingInSegment = currentSegment.duration - this.timelineElapsed;

      if (delta + 0.0001 >= remainingInSegment) {
        delta -= remainingInSegment;
        this.timelineIndex += 1;
        this.timelineElapsed = 0;
        this.schedulePhaseCue();
      } else {
        this.timelineElapsed += delta;
        delta = 0;
      }
    }

    if (this.remainingSeconds <= 0.01) {
      this.completeSession(true);
      return;
    }

    this.updateProgress();
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  completeSession(success) {
    if (!this.session) return;
    this.stopSession();
    this.showScreen('complete');
    cancelAnimationFrame(this.rafId);

    if (success) {
      if (this.totalSeconds >= 120) {
        this.updateStreak();
      }
      playBell(this.settings);
    }

    this.updateStreakMessage();
  }

  updateStreak() {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const last = this.streak.lastCompletionISO ? this.streak.lastCompletionISO.slice(0, 10) : null;

    if (last === todayKey) {
      return;
    }

    if (last) {
      const lastDate = new Date(last);
      const diff = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        this.streak.currentStreakDays += 1;
      } else {
        this.streak.currentStreakDays = 1;
      }
    } else {
      this.streak.currentStreakDays = 1;
    }

    this.streak.bestStreakDays = Math.max(this.streak.bestStreakDays, this.streak.currentStreakDays);
    this.streak.lastCompletionISO = now.toISOString();
    saveStreak(this.streak);
  }

  updateStreakMessage() {
    const dict = TRANSLATIONS[this.settings.lang];
    const message = dict.streak(this.streak.currentStreakDays ?? 0, this.streak.bestStreakDays ?? 0);
    this.elements.streak.textContent = message;
  }

  setPauseButtonLabel() {
    const dict = TRANSLATIONS[this.settings.lang];
    const key = this.isPaused ? 'resume' : 'pause';
    this.elements.pauseBtn.textContent = dict[key];
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new CalmaApp();
});
