import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';

const GameLogic = () => {
    const phase = useGameStore(state => state.phase);
    const setScore = useGameStore(state => state.setScore);
    const score = useGameStore(state => state.score);
    const setPhase = useGameStore(state => state.setPhase);
    const setHealth = useGameStore(state => state.setHealth);
    const health = useGameStore(state => state.health);
    const setCombo = useGameStore(state => state.setCombo);
    const combo = useGameStore(state => state.combo);
    const setPowerLevel = useGameStore(state => state.setPowerLevel);
    const powerLevel = useGameStore(state => state.powerLevel);

    // Game objects
    const lasers = useGameStore(state => state.lasers);
    const enemies = useGameStore(state => state.enemies);
    const powerUps = useGameStore(state => state.powerUps);
    const particles = useGameStore(state => state.particles);
    const boss = useGameStore(state => state.boss);

    // Store actions
    const updateLasers = useGameStore(state => state.updateLasers);
    const updateEnemies = useGameStore(state => state.updateEnemies);
    const updatePowerUps = useGameStore(state => state.updatePowerUps);
    const updateParticles = useGameStore(state => state.updateParticles);
    const updateBoss = useGameStore(state => state.updateBoss);
    const gesture = useGameStore(state => state.gesture);
    const handPosition = useGameStore(state => state.handPosition);
    const addLaser = useGameStore(state => state.addLaser);
    const addEnemy = useGameStore(state => state.addEnemy);
    const addPowerUp = useGameStore(state => state.addPowerUp);
    const addParticle = useGameStore(state => state.addParticle);
    const addBoss = useGameStore(state => state.addBoss);
    const setBoss = useGameStore(state => state.setBoss);
    const playSound = useGameStore(state => state.playSound);
    const addMessage = useGameStore(state => state.addMessage);

    // Game Constants
    const WIN_SCORE = 5000;
    const BOSS_SPAWN_SCORE = 1500;
    const MAX_HEALTH = 100;
    const MAX_POWER_LEVEL = 5;

    // Refs for throttling and timing
    const lastShot = useRef(0);
    const lastEnemySpawn = useRef(0);
    const lastPowerUpSpawn = useRef(0);
    const lastComboTick = useRef(0);
    const waveCount = useRef(0);
    const bossSpawned = useRef(false);
    const screenShake = useRef(0);
    const gameTime = useRef(0);

    // Enemy wave patterns
    const wavePatterns = [
        // Wave 1: Basic spread
        { count: 5, formation: 'line', speed: 20, health: 1 },
        // Wave 2: Diamond formation
        { count: 7, formation: 'diamond', speed: 22, health: 1 },
        // Wave 3: Spiral
        { count: 10, formation: 'spiral', speed: 25, health: 2 },
        // Wave 4: Sine wave
        { count: 8, formation: 'sine', speed: 23, health: 2 },
        // Wave 5: Circle
        { count: 12, formation: 'circle', speed: 20, health: 1 },
    ];

    // Power-up types
    const powerUpTypes = [
        { type: 'health', color: 0xff0000, effect: 'Restores 30 health' },
        { type: 'rapid', color: 0x00ff00, effect: 'Rapid fire for 10s' },
        { type: 'shield', color: 0x0000ff, effect: 'Invincibility for 8s' },
        { type: 'multi', color: 0xffff00, effect: 'Multi-shot for 12s' },
        { type: 'score', color: 0xff00ff, effect: '2x Score for 15s' },
    ];

    // Initialize game
    useEffect(() => {
        if (phase === 'playing') {
            setHealth(MAX_HEALTH);
            setCombo(1);
            setPowerLevel(1);
            waveCount.current = 0;
            bossSpawned.current = false;
            gameTime.current = 0;
            playSound('game_start');
            addMessage('Wave 1: Begin!', 2000);
        }
    }, [phase]);

    // Create particle explosion
    const createExplosion = useCallback((position, color = 0xff5500, count = 20) => {
        for (let i = 0; i < count; i++) {
            addParticle({
                id: Math.random(),
                type: 'explosion',
                position: [position.x, position.y, position.z],
                velocity: [
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 10
                ],
                color: color,
                size: Math.random() * 0.5 + 0.2,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }, [addParticle]);

    // Spawn enemy wave
    const spawnEnemyWave = useCallback((pattern) => {
        const centerX = (Math.random() - 0.5) * 20;
        const centerY = (Math.random() * 5) + 8;

        for (let i = 0; i < pattern.count; i++) {
            let x, y;
            const angle = (i / pattern.count) * Math.PI * 2;

            switch (pattern.formation) {
                case 'line':
                    x = centerX + (i - pattern.count / 2) * 3;
                    y = centerY;
                    break;
                case 'diamond':
                    x = centerX + Math.cos(angle) * 4;
                    y = centerY + Math.sin(angle) * 3;
                    break;
                case 'spiral':
                    const spiralRadius = 4 + (i * 0.5);
                    x = centerX + Math.cos(angle * 2) * spiralRadius;
                    y = centerY + Math.sin(angle * 2) * spiralRadius;
                    break;
                case 'sine':
                    x = centerX + (i - pattern.count / 2) * 2;
                    y = centerY + Math.sin(i * 0.8) * 3;
                    break;
                case 'circle':
                    x = centerX + Math.cos(angle) * 6;
                    y = centerY + Math.sin(angle) * 4;
                    break;
                default:
                    x = centerX + (Math.random() - 0.5) * 15;
                    y = centerY + Math.random() * 4;
            }

            addEnemy({
                id: Math.random(),
                type: pattern.health > 1 ? 'tank' : 'basic',
                x: x,
                y: y,
                z: -100,
                health: pattern.health,
                maxHealth: pattern.health,
                speed: pattern.speed,
                drift: (Math.random() - 0.5) * 0.03,
                fireRate: 0.5 + Math.random() * 1,
                lastShot: 0
            });
        }
    }, [addEnemy]);

    // Handle shooting with power-ups
    const handleShooting = useCallback((time, delta) => {
        if (gesture === 'fist') {
            const fireRate = 0.15 / Math.max(1, powerLevel * 0.3);

            if (time - lastShot.current > fireRate) {
                lastShot.current = time;
                playSound('laser_shoot');

                // Multi-shot based on power level
                const shotCount = powerLevel >= 4 ? 3 : 1;

                for (let i = 0; i < shotCount; i++) {
                    const spread = shotCount > 1 ? (i - (shotCount - 1) / 2) * 0.5 : 0;
                    addLaser({
                        id: Math.random(),
                        x: handPosition.x * 12 + spread,
                        y: handPosition.y * 7,
                        z: 0,
                        type: powerLevel >= 3 ? 'charged' : 'basic',
                        damage: powerLevel >= 3 ? 2 : 1,
                        color: powerLevel >= 3 ? 0x00ffff : 0xffff00
                    });
                }
            }
        }
    }, [gesture, handPosition, powerLevel, addLaser, playSound]);

    // Handle enemy behavior and shooting
    const updateEnemiesWithAI = useCallback((enemiesArray, time, delta) => {
        return enemiesArray.map(enemy => {
            // Move enemy
            let newX = enemy.x + (enemy.drift || 0);
            let newZ = enemy.z + enemy.speed * delta;

            // Add sinusoidal movement for some enemies
            if (enemy.type === 'basic') {
                newX += Math.sin(time * 2 + enemy.id * 0.1) * 0.3;
            }

            // Enemy shooting
            if (time - enemy.lastShot > enemy.fireRate && newZ < -5) {
                enemy.lastShot = time;
                // Enemy lasers go toward player
                const targetX = handPosition.x * 12;
                const targetY = handPosition.y * 7;
                const dx = targetX - newX;
                const dy = targetY - enemy.y;
                const dz = 0 - newZ;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                addLaser({
                    id: Math.random(),
                    x: newX,
                    y: enemy.y,
                    z: newZ,
                    type: 'enemy',
                    vx: dx / dist * 40,
                    vy: dy / dist * 40,
                    vz: dz / dist * 40,
                    color: 0xff0000
                });
                playSound('enemy_laser');
            }

            return { ...enemy, x: newX, z: newZ };
        });
    }, [handPosition, addLaser, playSound]);

    // Enhanced collision detection
    const checkCollisions = useCallback((lasersArray, enemiesArray, delta) => {
        let newScore = score;
        let newHealth = health;
        let newCombo = combo;
        let comboReset = false;

        // Laser vs Enemy collision
        lasersArray.forEach(laser => {
            if (laser.type === 'enemy') return;

            enemiesArray.forEach(enemy => {
                if (enemy.dead) return;

                const dx = laser.x - enemy.x;
                const dy = laser.y - enemy.y;
                const dz = laser.z - enemy.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (distance < 2.5) {
                    enemy.health -= laser.damage || 1;

                    if (enemy.health <= 0) {
                        enemy.dead = true;
                        const points = 500 * (enemy.type === 'tank' ? 2 : 1) * newCombo;
                        newScore += points;
                        setScore(newScore);

                        // Update combo
                        newCombo = Math.min(10, newCombo + 1);
                        setCombo(newCombo);

                        // Create explosion
                        createExplosion(
                            { x: enemy.x, y: enemy.y, z: enemy.z },
                            enemy.type === 'tank' ? 0xff0000 : 0xffaa00
                        );

                        // Chance to drop power-up
                        if (Math.random() < 0.2) {
                            const powerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                            addPowerUp({
                                id: Math.random(),
                                x: enemy.x,
                                y: enemy.y,
                                z: enemy.z,
                                type: powerUp.type,
                                color: powerUp.color,
                                rotation: 0
                            });
                        }

                        playSound('enemy_explosion');
                        addMessage(`+${points}`, 1000);
                    } else {
                        playSound('enemy_hit');
                        createExplosion(
                            { x: enemy.x, y: enemy.y, z: enemy.z },
                            0xffff00,
                            5
                        );
                    }
                }
            });
        });

        // Enemy laser vs Player collision
        lasersArray.filter(l => l.type === 'enemy').forEach(laser => {
            const dx = laser.x - handPosition.x * 12;
            const dy = laser.y - handPosition.y * 7;
            const dz = laser.z - 0;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < 2 && !useGameStore.getState().invincible) {
                newHealth -= 10;
                setHealth(newHealth);
                playSound('player_hit');
                screenShake.current = 0.3;
                createExplosion(
                    { x: laser.x, y: laser.y, z: laser.z },
                    0xff0000,
                    15
                );
                comboReset = true;
            }
        });

        // Enemy vs Player collision
        enemiesArray.forEach(enemy => {
            if (enemy.dead) return;

            const dx = enemy.x - handPosition.x * 12;
            const dy = enemy.y - handPosition.y * 7;
            const dz = enemy.z - 0;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < 3 && !useGameStore.getState().invincible) {
                newHealth -= 15;
                setHealth(newHealth);
                enemy.dead = true;
                playSound('player_hit');
                screenShake.current = 0.5;
                createExplosion(
                    { x: enemy.x, y: enemy.y, z: enemy.z },
                    0xff0000,
                    20
                );
                comboReset = true;
            }
        });

        // Reset combo if player was hit
        if (comboReset && newCombo > 1) {
            newCombo = 1;
            setCombo(newCombo);
            addMessage('Combo Lost!', 1500);
        }

        // Update combo timer
        if (time.current - lastComboTick.current > 5) {
            if (newCombo > 1) {
                newCombo = Math.max(1, newCombo - 1);
                setCombo(newCombo);
            }
            lastComboTick.current = time.current;
        }

        return { newScore, newHealth, newCombo };
    }, [score, health, combo, handPosition, createExplosion, playSound, addMessage]);

    // Update power-ups
    const updatePowerUpsLogic = useCallback((powerUpsArray, delta) => {
        return powerUpsArray.map(powerUp => {
            // Move power-up toward player
            const dx = handPosition.x * 12 - powerUp.x;
            const dy = handPosition.y * 7 - powerUp.y;
            const dz = 0 - powerUp.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const speed = 15 * delta;
            const newX = powerUp.x + (dx / dist) * speed;
            const newY = powerUp.y + (dy / dist) * speed;
            const newZ = powerUp.z + (dz / dist) * speed;

            // Check collision with player
            const playerDist = Math.sqrt(
                (newX - handPosition.x * 12) ** 2 +
                (newY - handPosition.y * 7) ** 2 +
                (newZ - 0) ** 2
            );

            if (playerDist < 2) {
                powerUp.collected = true;
                applyPowerUp(powerUp.type);
                playSound('powerup');
                createExplosion(
                    { x: powerUp.x, y: powerUp.y, z: powerUp.z },
                    powerUp.color,
                    10
                );
            }

            return {
                ...powerUp,
                x: newX,
                y: newY,
                z: newZ,
                rotation: powerUp.rotation + delta * 2
            };
        }).filter(p => !p.collected && p.z < 10);
    }, [handPosition, createExplosion, playSound]);

    // Apply power-up effects
    const applyPowerUp = useCallback((type) => {
        switch (type) {
            case 'health':
                setHealth(Math.min(MAX_HEALTH, health + 30));
                addMessage('Health +30', 1500);
                break;
            case 'rapid':
                useGameStore.getState().setPowerUpActive('rapid', 10);
                addMessage('Rapid Fire!', 1500);
                break;
            case 'shield':
                useGameStore.getState().setInvincible(8);
                addMessage('Shield Active!', 1500);
                break;
            case 'multi':
                useGameStore.getState().setPowerUpActive('multi', 12);
                addMessage('Multi-shot!', 1500);
                break;
            case 'score':
                useGameStore.getState().setPowerUpActive('score', 15);
                addMessage('2x Score!', 1500);
                break;
        }
    }, [health, setHealth, addMessage]);

    // Spawn boss enemy
    const spawnBoss = useCallback(() => {
        bossSpawned.current = true;
        addBoss({
            id: Math.random(),
            x: 0,
            y: 10,
            z: -150,
            health: 50,
            maxHealth: 50,
            phase: 1,
            pattern: 'circle',
            lastAttack: 0,
            moveDirection: 1
        });
        playSound('boss_spawn');
        addMessage('BOSS INCOMING!', 3000);
    }, [addBoss, playSound, addMessage]);

    // Update boss logic
    const updateBossLogic = useCallback((bossObj, time, delta) => {
        if (!bossObj) return null;

        let newBoss = { ...bossObj };

        // Boss movement pattern
        switch (newBoss.pattern) {
            case 'circle':
                newBoss.x = Math.sin(time * 0.5) * 15;
                newBoss.y = 10 + Math.cos(time * 0.3) * 3;
                break;
            case 'zigzag':
                newBoss.x += newBoss.moveDirection * 20 * delta;
                if (Math.abs(newBoss.x) > 20) {
                    newBoss.moveDirection *= -1;
                }
                break;
            case 'charge':
                newBoss.z += 40 * delta;
                if (newBoss.z > -30) {
                    newBoss.pattern = 'retreat';
                }
                break;
            case 'retreat':
                newBoss.z -= 20 * delta;
                if (newBoss.z < -80) {
                    newBoss.pattern = 'circle';
                }
                break;
        }

        // Boss attacks
        if (time - newBoss.lastAttack > 2) {
            newBoss.lastAttack = time;

            // Different attack patterns based on health
            if (newBoss.health > newBoss.maxHealth * 0.5) {
                // Phase 1: Circular attack
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    addLaser({
                        id: Math.random(),
                        x: newBoss.x,
                        y: newBoss.y,
                        z: newBoss.z,
                        type: 'boss',
                        vx: Math.cos(angle) * 25,
                        vy: Math.sin(angle) * 25,
                        vz: 0,
                        color: 0xff00ff
                    });
                }
            } else {
                // Phase 2: Targeted spread attack
                const targetX = handPosition.x * 12;
                const targetY = handPosition.y * 7;
                const dx = targetX - newBoss.x;
                const dy = targetY - newBoss.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                for (let i = -2; i <= 2; i++) {
                    const spread = i * 0.3;
                    addLaser({
                        id: Math.random(),
                        x: newBoss.x,
                        y: newBoss.y,
                        z: newBoss.z,
                        type: 'boss',
                        vx: (dx / dist + spread) * 30,
                        vy: (dy / dist + spread) * 30,
                        vz: 0,
                        color: 0xff0000
                    });
                }

                // Switch to charge pattern
                if (Math.random() < 0.3) {
                    newBoss.pattern = 'charge';
                }
            }

            playSound('boss_attack');
        }

        // Check boss collision with lasers
        lasers.forEach(laser => {
            if (laser.type === 'enemy' || laser.type === 'boss') return;

            const dx = laser.x - newBoss.x;
            const dy = laser.y - newBoss.y;
            const dz = laser.z - newBoss.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (distance < 5) {
                newBoss.health -= laser.damage || 1;
                createExplosion(
                    { x: laser.x, y: laser.y, z: laser.z },
                    0x00ffff,
                    5
                );

                if (newBoss.health <= newBoss.maxHealth * 0.5 && newBoss.phase === 1) {
                    newBoss.phase = 2;
                    addMessage('BOSS ENRAGED!', 2000);
                    playSound('boss_phase');
                }
            }
        });

        return newBoss.health > 0 ? newBoss : null;
    }, [handPosition, lasers, addLaser, createExplosion, playSound, addMessage]);

    // Main game loop
    useFrame((state, delta) => {
        gameTime.current += delta;
        const time = state.clock.elapsedTime;

        // Update screen shake
        if (screenShake.current > 0) {
            screenShake.current = Math.max(0, screenShake.current - delta * 2);
            const shakeIntensity = screenShake.current;
            state.camera.position.x = (Math.random() - 0.5) * shakeIntensity;
            state.camera.position.y = (Math.random() - 0.5) * shakeIntensity;
        }

        if (phase === 'playing') {
            // Handle player shooting
            handleShooting(time, delta);

            // Move lasers (including enemy lasers)
            const movedLasers = lasers.map(laser => {
                if (laser.type === 'enemy' || laser.type === 'boss') {
                    return {
                        ...laser,
                        x: laser.x + (laser.vx || 0) * delta,
                        y: laser.y + (laser.vy || 0) * delta,
                        z: laser.z + (laser.vz || 0) * delta
                    };
                }
                return { ...laser, z: laser.z - 40 * delta };
            }).filter(l => l.z > -150 && l.z < 50);
            updateLasers(movedLasers);

            // Spawn enemy waves
            if (enemies.length === 0 && time - lastEnemySpawn.current > 3) {
                lastEnemySpawn.current = time;
                const pattern = wavePatterns[waveCount.current % wavePatterns.length];
                spawnEnemyWave(pattern);
                waveCount.current++;

                if (waveCount.current > 0) {
                    addMessage(`Wave ${waveCount.current + 1}`, 2000);
                }
            }

            // Spawn power-ups occasionally
            if (time - lastPowerUpSpawn.current > 15 && Math.random() < 0.3) {
                lastPowerUpSpawn.current = time;
                const powerUp = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                addPowerUp({
                    id: Math.random(),
                    x: (Math.random() - 0.5) * 30,
                    y: Math.random() * 10 + 5,
                    z: -80,
                    type: powerUp.type,
                    color: powerUp.color,
                    rotation: 0
                });
            }

            // Update enemies with AI
            const updatedEnemies = updateEnemiesWithAI(enemies, time, delta);

            // Check all collisions
            const collisionResults = checkCollisions(movedLasers, updatedEnemies, delta);

            // Update power-ups
            const updatedPowerUps = updatePowerUpsLogic(powerUps, delta);
            updatePowerUps(updatedPowerUps);

            // Cleanup dead enemies
            const aliveEnemies = updatedEnemies.filter(e => !e.dead && e.z < 10);
            updateEnemies(aliveEnemies);

            // Update boss
            if (score >= BOSS_SPAWN_SCORE && !bossSpawned.current && aliveEnemies.length === 0) {
                spawnBoss();
            }

            if (boss) {
                const updatedBoss = updateBossLogic(boss, time, delta);
                if (!updatedBoss) {
                    // Boss defeated
                    const bossPoints = 5000 * combo;
                    setScore(score + bossPoints);
                    playSound('boss_defeat');
                    addMessage(`BOSS DEFEATED! +${bossPoints}`, 4000);
                    createExplosion(
                        { x: boss.x, y: boss.y, z: boss.z },
                        0xff00ff,
                        50
                    );
                    setBoss(null);
                } else {
                    updateBoss(updatedBoss);
                }
            }

            // Update particles
            const updatedParticles = particles.map(p => ({
                ...p,
                position: [
                    p.position[0] + p.velocity[0] * delta,
                    p.position[1] + p.velocity[1] * delta,
                    p.position[2] + p.velocity[2] * delta
                ],
                life: p.life - p.decay
            })).filter(p => p.life > 0);
            updateParticles(updatedParticles);

            // Time-based score (reduced to balance other score sources)
            const newScore = score + (delta * 50 * useGameStore.getState().scoreMultiplier);
            setScore(newScore);

            // Level up based on score
            const newPowerLevel = Math.min(MAX_POWER_LEVEL, Math.floor(newScore / 1000) + 1);
            if (newPowerLevel > powerLevel) {
                setPowerLevel(newPowerLevel);
                addMessage(`Power Level ${newPowerLevel}!`, 2000);
                playSound('level_up');
            }

            // Check win/lose conditions
            if (newScore >= WIN_SCORE) {
                setPhase('victory');
                playSound('victory');
            } else if (health <= 0) {
                setPhase('gameOver');
                playSound('game_over');
            }
        }
    });

    return null;
};

export default GameLogic;