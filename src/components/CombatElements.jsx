import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store';
import {
    Instances,
    Trail,
    MeshTransmissionMaterial,
    Float,
    Sparkles,
    Billboard
} from '@react-three/drei';
import * as THREE from 'three';

// ================= LASER SYSTEM =================
export const Lasers = () => {
    const { viewport } = useThree();
    const lasers = useGameStore(state => state.lasers);
    const laserSound = useRef();
    const sparklesRef = useRef();

    // Preload laser sound
    useEffect(() => {
        laserSound.current = new Audio('/sounds/laser-fire.mp3');
        laserSound.current.volume = 0.3;
    }, []);

    // Instance refs
    const instRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Particle system for laser impacts
    const particleSystemRef = useRef();
    const particleCount = 1000;
    const particlePositions = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
        return positions;
    }, []);

    useFrame((state, delta) => {
        if (!instRef.current) return;

        lasers.forEach((laser, i) => {
            // Update laser position
            const newY = laser.y + laser.speed * delta;
            useGameStore.getState().updateLaser(laser.id, { y: newY });

            // Remove if out of bounds
            if (newY > viewport.height * 2) {
                useGameStore.getState().removeLaser(laser.id);
                return;
            }

            // Update instance matrix
            dummy.position.set(laser.x, laser.y, laser.z);
            dummy.scale.set(
                laser.power * 0.5,
                laser.power * 2,
                laser.power * 0.5
            );
            dummy.updateMatrix();
            instRef.current.setMatrixAt(i, dummy.matrix);

            // Rotate laser slightly
            dummy.rotation.z += delta * 5;
        });

        instRef.current.instanceMatrix.needsUpdate = true;
        instRef.current.count = lasers.length;

        // Update particle system
        if (particleSystemRef.current) {
            particleSystemRef.current.rotation.y += delta * 0.5;
        }
    });

    // Laser hit effect
    const LaserHit = ({ position, scale = 1 }) => {
        const ref = useRef();
        const timeRef = useRef(0);

        useFrame((state, delta) => {
            if (!ref.current) return;

            timeRef.current += delta;
            ref.current.scale.setScalar(scale * (1 + timeRef.current * 2));
            ref.current.material.opacity = 1 - timeRef.current * 2;

            if (timeRef.current > 0.5) {
                ref.current.visible = false;
            }
        });

        return (
            <mesh ref={ref} position={position}>
                <sphereGeometry args={[0.3, 16, 16]} />
                <meshStandardMaterial
                    color="#ff00ff"
                    emissive="#ff00ff"
                    emissiveIntensity={2}
                    transparent
                    opacity={1}
                />
            </mesh>
        );
    };

    return (
        <>
            {/* Main laser instances */}
            <Instances ref={instRef} limit={100} range={lasers.length}>
                <cylinderGeometry args={[0.1, 0.05, 2, 8]} />
                <MeshTransmissionMaterial
                    backside
                    backsideThickness={0.2}
                    samples={8}
                    resolution={512}
                    transmission={1}
                    roughness={0.1}
                    thickness={0.5}
                    ior={2.5}
                    chromaticAberration={0.05}
                    anisotropy={0.1}
                    distortion={0.1}
                    distortionScale={0.2}
                    temporalDistortion={0.1}
                    color="#ff00ff"
                    emissive="#ff00ff"
                    emissiveIntensity={0.5}
                    toneMapped={false}
                />
            </Instances>

            {/* Laser trails */}
            {lasers.map(laser => (
                <Trail
                    key={`trail - ${laser.id} `}
                    width={0.5}
                    length={6}
                    color={new THREE.Color('#ff00ff')}
                    attenuation={(t) => t * t}
                >
                    <mesh position={[laser.x, laser.y, laser.z]}>
                        <sphereGeometry args={[0.1]} />
                        <meshBasicMaterial color="#ff00ff" />
                    </mesh>
                </Trail>
            ))}

            {/* Energy particles around lasers */}
            <Sparkles
                count={20}
                scale={[viewport.width, viewport.height, 2]}
                size={0.5}
                speed={0.1}
                color="#ff00ff"
            />

            {/* Laser hit particles */}
            <points ref={particleSystemRef}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={particleCount}
                        array={particlePositions}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.1}
                    color="#ff00ff"
                    transparent
                    opacity={0.6}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </>
    );
};

// ================= ENEMY SYSTEM =================
export const Enemies = () => {
    const enemies = useGameStore(state => state.enemies);
    const instRef = useRef();
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const materialColor = '#ff4444';

    // Enemy states for complex behaviors
    const enemyStates = useRef(new Map());

    useFrame((state, delta) => {
        if (!instRef.current) return;

        enemies.forEach((enemy, i) => {
            let state = enemyStates.current.get(enemy.id);
            if (!state) {
                state = {
                    bobOffset: Math.random() * Math.PI * 2,
                    rotationOffset: Math.random() * Math.PI * 2,
                    pulsePhase: Math.random() * Math.PI * 2,
                    thrusterPhase: Math.random() * Math.PI * 2,
                };
                enemyStates.current.set(enemy.id, state);
            }

            // Complex movement patterns
            const time = state.clock.getElapsedTime();
            const bobSpeed = enemy.speed * 0.5;
            const bobAmount = enemy.size * 0.2;

            // Sine wave movement for organic feel
            const newX = enemy.x + Math.sin(time * bobSpeed + state.bobOffset) * delta;
            const newY = enemy.y + Math.sin(time * bobSpeed * 1.5) * delta;
            const bobZ = Math.sin(time * bobSpeed + state.bobOffset) * bobAmount;

            // Update enemy position
            useGameStore.getState().updateEnemy(enemy.id, {
                x: newX,
                y: newY,
                z: bobZ,
            });

            // Enemy AI behaviors
            const playerPos = useGameStore.getState().playerPosition;
            const dx = playerPos.x - enemy.x;
            const dy = playerPos.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Aggressive behavior when close to player
            if (distance < 5) {
                const speedMultiplier = 2;
                const newX = enemy.x + (dx / distance) * enemy.speed * speedMultiplier * delta;
                const newY = enemy.y + (dy / distance) * enemy.speed * speedMultiplier * delta;
                useGameStore.getState().updateEnemy(enemy.id, { x: newX, y: newY });
            }

            // Update instance with complex transformations
            dummy.position.set(enemy.x, enemy.y, enemy.z + bobZ);
            dummy.rotation.x = Math.sin(time + state.rotationOffset) * 0.1;
            dummy.rotation.y = time * enemy.rotationSpeed + state.rotationOffset;
            dummy.rotation.z = Math.sin(time * 2) * 0.05;

            // Pulsing scale based on health
            const healthRatio = enemy.health / enemy.maxHealth;
            const pulse = 1 + Math.sin(time * 3 + state.pulsePhase) * 0.1 * healthRatio;
            dummy.scale.setScalar(enemy.size * pulse);

            dummy.updateMatrix();
            instRef.current.setMatrixAt(i, dummy.matrix);
        });

        instRef.current.instanceMatrix.needsUpdate = true;
        instRef.current.count = enemies.length;
    });

    // Complex enemy geometry generator
    const EnemyGeometry = ({ variant = 0 }) => {
        const geometry = useMemo(() => {
            const geo = new THREE.BufferGeometry();
            const vertices = [];
            const indices = [];

            // Generate unique enemy shape based on variant
            const segments = 8 + variant * 2;
            const radius = 1;
            const height = 2;

            // Body
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                vertices.push(
                    Math.cos(angle) * radius,
                    -height / 2,
                    Math.sin(angle) * radius
                );
                vertices.push(
                    Math.cos(angle) * radius * 0.7,
                    height / 2,
                    Math.sin(angle) * radius * 0.7
                );
            }

            // Top and bottom
            vertices.push(0, -height / 2 - 0.5, 0);
            vertices.push(0, height / 2 + 0.5, 0);

            // Create indices for faces
            // ... complex geometry generation logic ...

            geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();

            return geo;
        }, [variant]);

        return <primitive object={geometry} />;
    };

    // Enemy thruster effects
    const EnemyThruster = ({ enemy }) => {
        const ref = useRef();

        useFrame((state, delta) => {
            if (!ref.current) return;

            const time = state.clock.getElapsedTime();
            const intensity = 1 + Math.sin(time * 10) * 0.3;

            ref.current.scale.y = intensity;
            ref.current.material.opacity = 0.5 + Math.sin(time * 15) * 0.2;
        });

        return (
            <group position={[0, -enemy.size * 0.8, 0]}>
                <mesh ref={ref}>
                    <coneGeometry args={[0.3, 1, 8]} />
                    <meshBasicMaterial
                        color="#ff3300"
                        transparent
                        blending={THREE.AdditiveBlending}
                    />
                </mesh>
            </group>
        );
    };

    return (
        <>
            {/* Main enemy instances */}
            <Instances ref={instRef} limit={200} range={enemies.length}>
                <EnemyGeometry variant={0} />
                <meshStandardMaterial
                    color={materialColor}
                    metalness={0.8}
                    roughness={0.2}
                    emissive="#ff0000"
                    emissiveIntensity={0.3}
                    envMapIntensity={1}
                />
            </Instances>

            {/* Enemy details and effects */}
            {enemies.map(enemy => (
                <Float
                    key={`float - ${enemy.id} `}
                    speed={enemy.speed}
                    rotationIntensity={0.5}
                    floatIntensity={0.5}
                >
                    <group position={[enemy.x, enemy.y, enemy.z]}>
                        {/* Thruster effects */}
                        <EnemyThruster enemy={enemy} />

                        {/* Energy shield */}
                        {enemy.shield > 0 && (
                            <mesh>
                                <icosahedronGeometry args={[enemy.size * 1.2, 1]} />
                                <MeshTransmissionMaterial
                                    samples={4}
                                    resolution={256}
                                    thickness={0.1}
                                    roughness={0}
                                    transmission={0.9}
                                    ior={1.5}
                                    chromaticAberration={0.02}
                                    anisotropy={0.1}
                                    distortion={0.1}
                                    distortionScale={0.1}
                                    temporalDistortion={0.2}
                                    color="#00ffff"
                                    emissive="#00ffff"
                                    emissiveIntensity={0.2}
                                />
                            </mesh>
                        )}

                        {/* Health bar */}
                        <Billboard>
                            <group position={[0, enemy.size * 1.5, 0]}>
                                <mesh>
                                    <boxGeometry args={[enemy.size, 0.1, 0.1]} />
                                    <meshBasicMaterial color="#222222" />
                                </mesh>
                                <mesh position={[-(enemy.size / 2) * (1 - enemy.health / enemy.maxHealth), 0, 0.01]}>
                                    <boxGeometry args={[enemy.size * (enemy.health / enemy.maxHealth), 0.08, 0.1]} />
                                    <meshBasicMaterial
                                        color={enemy.health > 50 ? "#00ff00" : "#ff0000"}
                                        emissive={enemy.health > 50 ? "#00ff00" : "#ff0000"}
                                        emissiveIntensity={0.5}
                                    />
                                </mesh>
                            </group>
                        </Billboard>
                    </group>
                </Float>
            ))}

            {/* Enemy targeting indicators */}
            {enemies.filter(e => e.aggressive).map(enemy => (
                <mesh key={`target - ${enemy.id} `} position={[enemy.x, enemy.y + enemy.size * 2, enemy.z]}>
                    <ringGeometry args={[0.3, 0.35, 16]} />
                    <meshBasicMaterial
                        color="#ff0000"
                        transparent
                        opacity={0.7}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}
        </>
    );
};

// ================= ENEMY TYPES =================
export const EnemyVariants = {
    SCOUT: {
        size: 0.8,
        speed: 2,
        health: 50,
        rotationSpeed: 0.5,
        color: '#ff6666',
        behavior: 'evasive'
    },
    FIGHTER: {
        size: 1.2,
        speed: 1.5,
        health: 100,
        rotationSpeed: 0.3,
        color: '#ff3333',
        behavior: 'aggressive'
    },
    CRUISER: {
        size: 2,
        speed: 0.8,
        health: 300,
        rotationSpeed: 0.1,
        color: '#ff0000',
        behavior: 'tank'
    },
    BOSS: {
        size: 4,
        speed: 0.3,
        health: 2000,
        rotationSpeed: 0.05,
        color: '#990000',
        behavior: 'boss'
    }
};

// ================= ENEMY SPAWNER =================
export const EnemySpawner = () => {
    const spawnEnemy = useGameStore(state => state.spawnEnemy);
    const wave = useGameStore(state => state.wave);

    useEffect(() => {
        const interval = setInterval(() => {
            // Spawn logic based on wave
            const variantKey = Object.keys(EnemyVariants)[
                Math.floor(Math.random() * Object.keys(EnemyVariants).length)
            ];
            const variant = EnemyVariants[variantKey];

            spawnEnemy({
                ...variant,
                x: (Math.random() - 0.5) * 20,
                y: -10,
                z: (Math.random() - 0.5) * 5,
                type: variantKey,
                shield: variantKey === 'BOSS' ? 100 : 0,
                weapons: variantKey === 'FIGHTER' ? ['laser', 'missile'] : ['laser']
            });
        }, 2000 - Math.min(wave * 100, 1800)); // Faster spawns as waves increase

        return () => clearInterval(interval);
    }, [wave, spawnEnemy]);

    return null;
};

// ================= ENEMY BEHAVIOR MANAGER =================
export const EnemyBehaviorManager = () => {
    useFrame((state, delta) => {
        const enemies = useGameStore.getState().enemies;
        const playerPos = useGameStore.getState().playerPosition;

        enemies.forEach(enemy => {
            // Complex AI behaviors
            switch (enemy.behavior) {
                case 'evasive':
                    // Move in unpredictable patterns
                    const evasiveX = enemy.x + Math.sin(state.clock.elapsedTime * 2) * delta * 2;
                    const evasiveY = enemy.y + Math.cos(state.clock.elapsedTime * 1.5) * delta * 2;
                    useGameStore.getState().updateEnemy(enemy.id, { x: evasiveX, y: evasiveY });
                    break;

                case 'aggressive':
                    // Chase player
                    const dx = playerPos.x - enemy.x;
                    const dy = playerPos.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const chaseX = enemy.x + (dx / dist) * enemy.speed * delta;
                        const chaseY = enemy.y + (dy / dist) * enemy.speed * delta;
                        useGameStore.getState().updateEnemy(enemy.id, { x: chaseX, y: chaseY });
                    }
                    break;

                case 'boss':
                    // Complex boss patterns
                    const bossX = Math.sin(state.clock.elapsedTime * 0.5) * 8;
                    const bossY = Math.cos(state.clock.elapsedTime * 0.3) * 6;
                    useGameStore.getState().updateEnemy(enemy.id, { x: bossX, y: bossY });
                    break;
            }
        });
    });

    return null;
};
