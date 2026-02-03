import { create } from 'zustand';

const powerUpTimers = {};

const clearTimer = (key) => {
  if (powerUpTimers[key]) {
    clearTimeout(powerUpTimers[key]);
    delete powerUpTimers[key];
  }
};

const clearAllTimers = () => {
  Object.keys(powerUpTimers).forEach(clearTimer);
};

export const useGameStore = create((set, get) => ({
  // Game Phase: 'menu', 'playing', 'paused', 'gameOver', 'victory'
  phase: 'menu',

  // Selection
  selectedShip: 'speedster', // 'speedster', 'tank', 'balanced'
  selectedCity: 'neon_city', // 'neon_city', 'mars_colony', 'retro_grid', 'cyberpunk', 'abandoned'

  // Gameplay State
  score: 0,
  highScore: 0,
  health: 100,
  distance: 0,
  speed: 1.0,
  wave: 1,

  // Advanced State
  combo: 1,
  powerLevel: 1,
  scoreMultiplier: 1,
  invincible: false,
  rapidFire: false,
  multiShot: false,
  timeLeft: 0,
  controlMode: 'auto', // 'auto' | 'hand' | 'keyboard'
  keyboardActive: false,

  // Combat State
  lasers: [], // { id, x, y, z, type, ... }
  enemies: [], // { id, x, y, z, ... }
  powerUps: [], // { id, x, y, z, type, ... }
  particles: [], // { id, position, velocity, color, ... }
  boss: null,

  // Hand Input
  handPosition: { x: 0, y: 0, z: 0 },
  isHandDetected: false,
  gesture: 'none',
  gestureConfidence: 0,
  handLandmarks: [],

  // Actions
  setPhase: (phase) => set({ phase }),
  setWave: (wave) => set({ wave }),
  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setControlMode: (controlMode) => set({ controlMode }),
  setKeyboardActive: (keyboardActive) => set({ keyboardActive }),

  // Game Controls
  startGame: () => {
    clearAllTimers();
    set({
      phase: 'playing',
      score: 0,
      health: 100,
      distance: 0,
      speed: 1.0,
      wave: 1,
      combo: 1,
      powerLevel: 1,
      scoreMultiplier: 1,
      invincible: false,
      rapidFire: false,
      multiShot: false,
      keyboardActive: false,
      timeLeft: 0,
      lasers: [],
      enemies: [],
      powerUps: [],
      particles: [],
      boss: null
    });
  },
  resetGame: () => {
    clearAllTimers();
    set({
      phase: 'menu',
      score: 0,
      health: 100,
      distance: 0,
      speed: 1.0,
      wave: 1,
      combo: 1,
      powerLevel: 1,
      scoreMultiplier: 1,
      invincible: false,
      rapidFire: false,
      multiShot: false,
      keyboardActive: false,
      timeLeft: 0,
      lasers: [],
      enemies: [],
      powerUps: [],
      particles: [],
      boss: null
    });
  },
  pauseGame: () => set((state) => {
    if (state.phase !== 'playing' && state.phase !== 'paused') return state;
    return { phase: state.phase === 'playing' ? 'paused' : 'playing' };
  }),

  // Stats
  setScore: (score) => set((state) => ({
    score,
    highScore: Math.max(score, state.highScore)
  })),
  setHealth: (health) => set({ health }),
  setCombo: (combo) => set({ combo }),
  setPowerLevel: (powerLevel) => set({ powerLevel }),

  // ENTITY MANAGEMENT

  // Lasers
  addLaser: (laser) => set((state) => ({ lasers: [...state.lasers, laser] })),
  removeLaser: (id) => set((state) => ({ lasers: state.lasers.filter(l => l.id !== id) })),
  updateLasers: (newLasers) => set({ lasers: newLasers }),
  updateLaser: (id, updates) => set((state) => ({
    lasers: state.lasers.map(l => l.id === id ? { ...l, ...updates } : l)
  })),
  fireLaser: () => {
    // This is handled in GameLogic usually, but we keep the action for HandController API consistency
  },

  // Enemies
  spawnEnemy: (enemy) => set((state) => ({ enemies: [...state.enemies, enemy] })),
  addEnemy: (enemy) => set((state) => ({ enemies: [...state.enemies, enemy] })), // Alias
  removeEnemy: (id) => set((state) => ({ enemies: state.enemies.filter(e => e.id !== id) })),
  updateEnemies: (newEnemies) => set({ enemies: newEnemies }),
  updateEnemy: (id, updates) => set((state) => ({
    enemies: state.enemies.map(e => e.id === id ? { ...e, ...updates } : e)
  })),

  // Boss
  addBoss: (boss) => set({ boss }),
  setBoss: (boss) => set({ boss }),
  updateBoss: (boss) => set({ boss }),

  // PowerUps
  addPowerUp: (powerUp) => set((state) => ({ powerUps: [...state.powerUps, powerUp] })),
  updatePowerUps: (newPowerUps) => set({ powerUps: newPowerUps }),
  activatePowerUp: (type, duration = 8) => {
    if (type === 'health') {
      set((state) => ({ health: Math.min(100, state.health + 30) }));
      return;
    }
    if (type === 'double_shot') {
      get().setPowerUpActive('multi', duration);
      return;
    }
    if (type === 'shield') {
      get().setInvincible(duration);
      return;
    }
    get().setPowerUpActive(type, duration);
  },
  setPowerUpActive: (type, duration = 8) => {
    const durationMs = duration * 1000;
    if (type === 'rapid') {
      set({ rapidFire: true });
      clearTimer('rapid');
      powerUpTimers.rapid = setTimeout(() => set({ rapidFire: false }), durationMs);
      return;
    }
    if (type === 'multi') {
      set({ multiShot: true });
      clearTimer('multi');
      powerUpTimers.multi = setTimeout(() => set({ multiShot: false }), durationMs);
      return;
    }
    if (type === 'score') {
      set({ scoreMultiplier: 2 });
      clearTimer('score');
      powerUpTimers.score = setTimeout(() => set({ scoreMultiplier: 1 }), durationMs);
    }
  },

  // Particles
  addParticle: (particle) => set((state) => ({ particles: [...state.particles, particle] })),
  updateParticles: (newParticles) => set({ particles: newParticles }),

  // Hand State
  setHandPosition: (x, y, z = 0) => set({ handPosition: { x, y, z } }),
  setHandDetected: (isDetected) => set({ isHandDetected: isDetected }),
  setGesture: (gesture) => set({ gesture }),
  setGestureConfidence: (confidence) => set({ gestureConfidence: confidence }),
  setHandLandmarks: (landmarks) => set({ handLandmarks: landmarks }),

  // Weapon System
  changeWeapon: () => {
    // Toggle weapon logic
  },

  // Systems
  playSound: () => {
    // Placeholder for future audio hooks
  },

  addMessage: (text) => {
    // Simple notification system
    console.log("Message:", text);
  },

  setInvincible: (duration = 8) => {
    set({ invincible: true });
    clearTimer('invincible');
    powerUpTimers.invincible = setTimeout(() => set({ invincible: false }), duration * 1000);
  },

}));
