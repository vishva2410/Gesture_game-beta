import { create } from 'zustand';

export const useGameStore = create((set) => ({
  // Game Phase: 'menu', 'playing', 'gameover', 'victory'
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
  timeLeft: 0,
  activePowerUps: {},

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

  // Game Controls
  startGame: () => set({
    phase: 'playing',
    score: 0,
    health: 100,
    distance: 0,
    speed: 1.0,
    wave: 1,
    combo: 1,
    powerLevel: 1,
    timeLeft: 0,
    lasers: [],
    enemies: [],
    powerUps: [],
    particles: [],
    boss: null
  }),
  resetGame: () => set({ phase: 'menu', score: 0, health: 100 }),
  pauseGame: () => set((state) => ({ phase: state.phase === 'playing' ? 'paused' : 'playing' })),

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
  activatePowerUp: (type) => {
    // Logic handled via GameLogic calling setPowerUpActive, or here
    console.log("PowerUp Activated:", type);
  },
  setPowerUpActive: (type, duration) => set((state) => ({
    activePowerUps: {
      ...state.activePowerUps,
      [type]: Date.now() + duration * 1000
    }
  })),

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
    // Simple audio player integration
    // We could use a separate Audio Manager, but for now this is a placeholder hook
  },

  addMessage: (text) => {
    // Simple notification system
    console.log("Message:", text);
  },

  setInvincible: () => set({ invincible: true }), // Logic will handle timeout

}));
