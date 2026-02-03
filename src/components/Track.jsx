import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { Box, Instance, Instances, Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';

const CITY_THEMES = {
    neon_city: {
        groundColor: '#111',
        buildingColors: ['#0ff', '#f0f', '#ff0', '#00f'],
        fogColor: '#000020',
        ambientLight: '#002020',
        glowIntensity: 1.5,
        streetLightColor: '#ffff00',
        hologramColor: '#00ffaa'
    },
    mars_colony: {
        groundColor: '#532',
        buildingColors: ['#a44', '#d66', '#833', '#c55'],
        fogColor: '#843',
        ambientLight: '#552211',
        glowIntensity: 0.8,
        streetLightColor: '#ff8844',
        hologramColor: '#ff5533'
    },
    retro_grid: {
        groundColor: '#000',
        buildingColors: ['#f0f', '#0ff'],
        fogColor: '#102',
        ambientLight: '#220033',
        glowIntensity: 2.0,
        streetLightColor: '#ff00ff',
        hologramColor: '#00ffff'
    },
    cyberpunk: {
        groundColor: '#0a0a1a',
        buildingColors: ['#00ffaa', '#ff0080', '#0080ff', '#ffff00'],
        fogColor: '#000030',
        ambientLight: '#001030',
        glowIntensity: 2.5,
        streetLightColor: '#00ffaa',
        hologramColor: '#ff0080'
    },
    abandoned: {
        groundColor: '#2a2a2a',
        buildingColors: ['#666', '#888', '#aaa', '#444'],
        fogColor: '#333333',
        ambientLight: '#222222',
        glowIntensity: 0.3,
        streetLightColor: '#ff4400',
        hologramColor: '#ffffff'
    }
};

const BuildingType = {
    SKYSCRAPER: 'skyscraper',
    TOWER: 'tower',
    BLOCK: 'block',
    ARCH: 'arch',
    SPIRE: 'spire',
    BRIDGE: 'bridge',
    HOLOGRAM: 'hologram'
};

// Deterministic random helper
const seededRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const BuildingInstance = ({
    position,
    color,
    speed,
    type = BuildingType.BLOCK,
    rotation = 0,
    pulseIntensity = 0,
    isDamaged = false,
    dimensions
}) => {
    const ref = useRef();
    const [pulse, setPulse] = useState(0);
    // Stable seed based on position
    const seed = position[0] * 12.34 + position[2] * 56.78;
    const timeOffset = useRef(seededRandom(seed) * 100);

    const selectedCity = useGameStore(state => state.selectedCity);
    const theme = CITY_THEMES[selectedCity];

    useFrame((state, delta) => {
        if (ref.current) {
            // Move building
            ref.current.position.z += speed * delta;

            // Apply pulsing effect
            if (pulseIntensity > 0) {
                const pulseValue = Math.sin(state.clock.elapsedTime * 3 + timeOffset.current) * 0.1 * pulseIntensity;
                ref.current.scale.y = 1 + pulseValue;
                setPulse(pulseValue);
            }

            // Add subtle sway for damaged buildings
            if (isDamaged) {
                ref.current.rotation.z = Math.sin(state.clock.elapsedTime + timeOffset.current) * 0.05;
            }

            // Reset if behind camera
            if (ref.current.position.z > 20) {
                ref.current.position.z = -200 - Math.random() * 100;
                ref.current.position.x = (Math.random() - 0.5) * 45;
                // Ensure we leave a gap in the middle for the player
                if (Math.abs(ref.current.position.x) < 6) {
                    ref.current.position.x += 12 * Math.sign(ref.current.position.x || 1);
                }

                // Randomize rotation for certain building types
                if (type === BuildingType.TOWER) {
                    ref.current.rotation.y = Math.random() * Math.PI;
                }
            }
        }
    });

    const getBuildingShape = () => {
        if (dimensions) return dimensions;

        // Fallback or default shapes based on type if dimensions not provided
        // Use seeded random for stability during render
        const r = seededRandom(seed);

        switch (type) {
            case BuildingType.SKYSCRAPER:
                return [1.5, r * 25 + 15, 1.5];
            case BuildingType.TOWER:
                return [1, r * 30 + 20, 1];
            case BuildingType.ARCH:
                return [3, r * 12 + 8, 1];
            case BuildingType.SPIRE:
                return [0.5, r * 40 + 30, 0.5];
            case BuildingType.HOLOGRAM:
                return [4, r * 10 + 5, 0.1];
            default:
                return [2, r * 15 + 5, 2];
        }
    };

    const getBuildingMaterial = () => {
        if (type === BuildingType.HOLOGRAM) {
            return (
                <meshStandardMaterial
                    color={theme.hologramColor}
                    emissive={theme.hologramColor}
                    emissiveIntensity={2}
                    transparent
                    opacity={0.7}
                    wireframe
                />
            );
        }

        return (
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={theme.glowIntensity * (0.5 + Math.abs(pulse) * 2)}
                roughness={isDamaged ? 0.9 : 0.3}
                metalness={isDamaged ? 0.1 : 0.8}
            />
        );
    };

    return (
        <Box
            ref={ref}
            args={getBuildingShape()}
            position={position}
            rotation={[0, rotation, 0]}
        >
            {getBuildingMaterial()}
        </Box>
    );
};

const AnimatedSign = ({ position, text, speed }) => {
    const ref = useRef();
    const [colorIndex, setColorIndex] = useState(0);
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.position.z += speed * delta * 0.8; // Signs move slower

            // Color cycling
            if (Math.floor(state.clock.elapsedTime * 2) % 3 === 0) {
                setColorIndex((Math.floor(state.clock.elapsedTime) + Math.floor(position[0])) % colors.length);
            }

            if (ref.current.position.z > 20) {
                ref.current.position.z = -180 - Math.random() * 40;
            }
        }
    });

    return (
        <Billboard
            ref={ref}
            position={position}
            args={[10, 2]}
            follow={true}
            lockX={false}
            lockY={false}
            lockZ={false}
        >
            <Text
                fontSize={1}
                color={colors[colorIndex]}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.1}
                outlineColor="#000000"
            >
                {text}
            </Text>
        </Billboard>
    );
};

const FloatingVehicle = ({ position, speed, type = 'car' }) => {
    const ref = useRef();
    const timeOffset = useRef(Math.random() * 1000);

    useFrame((state, delta) => {
        if (!ref.current) return;

        ref.current.position.z += speed * delta * 0.8;
        ref.current.position.y += Math.sin(state.clock.elapsedTime * 2 + timeOffset.current) * 0.01;
        ref.current.rotation.y += delta * 0.3;

        if (ref.current.position.z > 20) {
            ref.current.position.z = -200 - Math.random() * 80;
            ref.current.position.x = (Math.random() - 0.5) * 35;
            ref.current.position.y = Math.random() * 10 + 5;
        }
    });

    const bodyColor = type === 'truck' ? '#ff8844' : '#00ffff';
    const accentColor = type === 'truck' ? '#ffaa66' : '#66ffff';
    const bodyArgs = type === 'truck' ? [2.6, 0.8, 1.2] : [2.0, 0.6, 1.0];

    return (
        <group ref={ref} position={position}>
            <mesh>
                <boxGeometry args={bodyArgs} />
                <meshStandardMaterial
                    color={bodyColor}
                    emissive={bodyColor}
                    emissiveIntensity={1.2}
                    roughness={0.4}
                    metalness={0.6}
                />
            </mesh>
            <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[bodyArgs[0] * 0.6, 0.4, bodyArgs[2] * 0.8]} />
                <meshStandardMaterial
                    color={accentColor}
                    emissive={accentColor}
                    emissiveIntensity={0.8}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>
            <mesh position={[0, -0.45, 0]}>
                <planeGeometry args={[bodyArgs[0] * 1.4, bodyArgs[2] * 1.1]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.15}
                />
            </mesh>
        </group>
    );
};

const GridLines = ({ position, size, color, speed }) => {
    const ref = useRef();
    const points = useMemo(() => [
        new THREE.Vector3(-size / 2, 0, 0),
        new THREE.Vector3(size / 2, 0, 0),
        new THREE.Vector3(0, -size / 2, 0),
        new THREE.Vector3(0, size / 2, 0),
    ], [size]);

    useFrame((_, delta) => {
        if (ref.current) {
            ref.current.position.z += speed * delta;
            ref.current.material.opacity = 0.5 + Math.sin(ref.current.position.z * 0.1) * 0.3;

            if (ref.current.position.z > 10) {
                ref.current.position.z = -100 - Math.random() * 50;
            }
        }
    });

    return (
        <Line
            ref={ref}
            points={points}
            color={color}
            lineWidth={2}
            position={position}
            dashed
            dashSize={1}
            gapSize={0.5}
        />
    );
};

const DynamicFog = ({ color }) => {
    const ref = useRef();

    useFrame((state) => {
        if (ref.current) {
            // Animate fog density based on time
            const density = 0.02 + Math.sin(state.clock.elapsedTime * 0.5) * 0.01;
            ref.current.density = density;
        }
    });

    return <fog ref={ref} attach="fog" args={[color, 5, 80]} />;
};

const ParticleField = ({ count = 100, speed, theme }) => {
    const particlesRef = useRef();
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const r1 = seededRandom(i * 1.1 + count);
            const r2 = seededRandom(i * 2.2 + count);
            const r3 = seededRandom(i * 3.3 + count);
            const r4 = seededRandom(i * 4.4 + count);

            temp.push({
                position: [
                    (r1 - 0.5) * 100,
                    r2 * 50,
                    -r3 * 200
                ],
                size: r4 * 0.5 + 0.1,
                speed: speed * (0.5 + r1),
                color: theme.buildingColors[Math.floor(r2 * theme.buildingColors.length)]
            });
        }
        return temp;
    }, [count, speed, theme]);

    useFrame((_, delta) => {
        if (particlesRef.current) {
            particlesRef.current.children.forEach((particle, i) => {
                particle.position.z += particles[i].speed * delta;
                particle.rotation.x += delta * 0.5;
                particle.rotation.y += delta * 0.3;

                if (particle.position.z > 20) {
                    particle.position.z = -200;
                    particle.position.x = (Math.random() - 0.5) * 100;
                    particle.position.y = Math.random() * 50;
                }
            });
        }
    });

    return (
        <group ref={particlesRef}>
            {particles.map((p, i) => (
                <mesh key={i} position={p.position}>
                    <sphereGeometry args={[p.size, 8, 8]} />
                    <meshBasicMaterial color={p.color} transparent opacity={0.6} />
                </mesh>
            ))}
        </group>
    );
};

const Track = () => {
    const selectedCity = useGameStore(state => state.selectedCity);
    const speed = useGameStore(state => state.speed);
    const phase = useGameStore(state => state.phase);
    const score = useGameStore(state => state.score);

    const [activeSigns, setActiveSigns] = useState([]);
    const theme = CITY_THEMES[selectedCity];

    // Dynamic speed based on game phase and score
    const currentSpeed = useMemo(() => {
        let baseSpeed = speed * 25;
        if (phase === 'menu' || phase === 'paused') return 0;
        if (phase === 'victory') return baseSpeed * 2;
        if (phase === 'gameOver') return baseSpeed * 0.5;

        // Speed increases with score
        const scoreBonus = Math.min(score / 1000, 10);
        return baseSpeed * (1 + scoreBonus * 0.1);
    }, [speed, phase, score]);

    // Generate initial buildings with variety
    const buildingCount = 60;
    const buildings = useMemo(() => {
        const temp = [];
        const buildingTypes = Object.values(BuildingType);

        for (let i = 0; i < buildingCount; i++) {
            const r1 = seededRandom(i * 11);
            const r2 = seededRandom(i * 22);
            const r3 = seededRandom(i * 33);
            const r4 = seededRandom(i * 44);
            const r5 = seededRandom(i * 55);
            const r6 = seededRandom(i * 66);
            const r7 = seededRandom(i * 77);
            const rDim = seededRandom(i * 99);

            const x = (r1 - 0.5) * 45;
            const finalX = Math.abs(x) < 6 ? x + 12 * Math.sign(x || 1) : x;
            const buildingType = buildingTypes[Math.floor(r2 * buildingTypes.length)];
            const isDamaged = selectedCity === 'abandoned' && r3 > 0.7;

            // Generate dimensions to prevent flickering and save re-calc
            let width = 2, height = rDim * 15 + 5, depth = 2;
            if (buildingType === BuildingType.SKYSCRAPER) { width = 1.5; height = rDim * 25 + 15; depth = 1.5; }
            else if (buildingType === BuildingType.TOWER) { width = 1; height = rDim * 30 + 20; depth = 1; }
            else if (buildingType === BuildingType.ARCH) { width = 3; height = rDim * 12 + 8; depth = 1; }
            else if (buildingType === BuildingType.SPIRE) { width = 0.5; height = rDim * 40 + 30; depth = 0.5; }
            else if (buildingType === BuildingType.HOLOGRAM) { width = 4; height = rDim * 10 + 5; depth = 0.1; }

            temp.push({
                id: i,
                position: [finalX, 0, -r4 * 300],
                color: theme.buildingColors[Math.floor(r5 * theme.buildingColors.length)],
                type: buildingType,
                rotation: buildingType === BuildingType.TOWER ? r6 * Math.PI : 0,
                pulseIntensity: buildingType === BuildingType.HOLOGRAM ? 2 : r7,
                isDamaged,
                dimensions: [width, height, depth]
            });
        }
        return temp;
    }, [selectedCity, theme]);

    // Generate floating vehicles
    const vehicles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < 20; i++) {
            const r1 = seededRandom(i * 101);
            const r2 = seededRandom(i * 202);
            const r3 = seededRandom(i * 303);

            const type = r1 > 0.5 ? 'car' : 'truck';
            temp.push({
                position: [
                    (r2 - 0.5) * 35,
                    r3 * 10 + 5,
                    -seededRandom(i * 404) * 200
                ],
                type
            });
        }
        return temp;
    }, []);

    // Generate dynamic signs
    const signTexts = useMemo(() => {
        const texts = [
            "SCORE: " + score,
            "POWER UP",
            "WARNING",
            "GO FAST",
            "NEON CITY",
            "SYSTEM ONLINE",
            "VIRTUAL REALITY",
            "GAME ON",
            "HIGH SCORE",
            "LEVEL UP"
        ];

        const temp = [];
        for (let i = 0; i < 8; i++) {
            const r1 = seededRandom(i * 1.1 + score);
            const r2 = seededRandom(i * 2.2 + score);
            const r3 = seededRandom(i * 3.3 + score);
            const r4 = seededRandom(i * 4.4 + score);

            temp.push({
                position: [
                    (r1 - 0.5) * 30,
                    r2 * 20 + 10,
                    -r3 * 250
                ],
                text: texts[Math.floor(r4 * texts.length)]
            });
        }
        return temp;
    }, [score]);

    // Generate grid lines for retro theme
    const gridLines = useMemo(() => {
        if (selectedCity !== 'retro_grid') return [];

        const temp = [];
        for (let i = 0; i < 15; i++) {
            const r1 = seededRandom(i * 10);
            const r2 = seededRandom(i * 20);
            const r3 = seededRandom(i * 30);
            const r4 = seededRandom(i * 40);

            temp.push({
                position: [
                    (r1 - 0.5) * 40,
                    -1,
                    -r2 * 200
                ],
                size: r3 * 20 + 10,
                color: theme.buildingColors[Math.floor(r4 * theme.buildingColors.length)]
            });
        }
        return temp;
    }, [selectedCity, theme]);

    // Environmental particles
    const particleCount = selectedCity === 'cyberpunk' ? 200 : 50;

    // Interactive billboards that respond to score
    useFrame(() => {
        if (score > 0 && score % 1000 < 50 && activeSigns.length < 5) {
            const newSign = {
                position: [
                    (Math.random() - 0.5) * 25,
                    Math.random() * 15 + 8,
                    -50 - Math.random() * 50
                ],
                text: `+${Math.floor(score / 1000) * 1000}`
            };
            setActiveSigns(prev => [...prev.slice(-4), newSign]);
        }
    });

    return (
        <group>
            {/* Ambient light based on theme */}
            <ambientLight color={theme.ambientLight} intensity={0.3} />
            <pointLight
                position={[0, 20, 0]}
                color={theme.streetLightColor}
                intensity={1}
                distance={100}
            />

            {/* Dynamic fog */}
            <DynamicFog color={theme.fogColor} speed={currentSpeed} />

            {/* Ground with texture */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
                <planeGeometry args={[120, 400, 20, 20]} />
                <meshStandardMaterial
                    color={theme.groundColor}
                    roughness={0.8}
                    metalness={0.2}
                    wireframe={selectedCity === 'retro_grid'}
                />
            </mesh>

            {/* Road markings for some themes */}
            {['neon_city', 'cyberpunk'].includes(selectedCity) && (
                <group>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.9, 0]}>
                        <planeGeometry args={[8, 400]} />
                        <meshStandardMaterial
                            color="#222"
                            emissive="#222"
                            emissiveIntensity={0.5}
                        />
                    </mesh>
                    {Array.from({ length: 40 }).map((_, i) => (
                        <mesh
                            key={i}
                            rotation={[-Math.PI / 2, 0, 0]}
                            position={[0, -2.8, -i * 10 + Math.sin(i) * 2]}
                        >
                            <planeGeometry args={[1, 4]} />
                            <meshStandardMaterial
                                color="#ffff00"
                                emissive="#ffff00"
                                emissiveIntensity={1}
                            />
                        </mesh>
                    ))}
                </group>
            )}

            {/* Main buildings */}
            {buildings.map((data) => (
                <BuildingInstance
                    key={data.id}
                    position={data.position}
                    color={data.color}
                    speed={currentSpeed}
                    type={data.type}
                    rotation={data.rotation}
                    pulseIntensity={data.pulseIntensity}
                    isDamaged={data.isDamaged}
                />
            ))}

            {/* Floating vehicles */}
            {vehicles.map((data, i) => (
                <FloatingVehicle
                    key={`v-${i}`}
                    position={data.position}
                    speed={currentSpeed}
                    type={data.type}
                />
            ))}

            {/* Static signs */}
            {signTexts.map((data, i) => (
                <AnimatedSign
                    key={`s-${i}`}
                    position={data.position}
                    text={data.text}
                    speed={currentSpeed}
                    theme={theme}
                />
            ))}

            {/* Dynamic score signs */}
            {activeSigns.map((sign, i) => (
                <AnimatedSign
                    key={`ds-${i}`}
                    position={sign.position}
                    text={sign.text}
                    speed={currentSpeed * 1.5}
                    theme={theme}
                />
            ))}

            {/* Grid lines for retro theme */}
            {gridLines.map((data, i) => (
                <GridLines
                    key={`g-${i}`}
                    position={data.position}
                    size={data.size}
                    color={data.color}
                    speed={currentSpeed}
                />
            ))}

            {/* Particle field */}
            <ParticleField
                count={particleCount}
                speed={currentSpeed}
                theme={theme}
            />

            {/* Distant city backdrop */}
            <mesh position={[0, 15, -300]} rotation={[0, 0, 0]}>
                <planeGeometry args={[200, 50]} />
                <meshBasicMaterial
                    color={theme.fogColor}
                    transparent
                    opacity={0.3}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Street lights */}
            {Array.from({ length: 20 }).map((_, i) => (
                <group key={`light-${i}`} position={[-25 + (i % 2) * 50, 5, -i * 20]}>
                    <mesh position={[0, 0, 0]}>
                        <cylinderGeometry args={[0.2, 0.2, 8]} />
                        <meshStandardMaterial color="#888" />
                    </mesh>
                    <pointLight
                        position={[0, 4, 0]}
                        color={theme.streetLightColor}
                        intensity={1}
                        distance={20}
                    />
                </group>
            ))}
        </group>
    );
};

export default Track;
