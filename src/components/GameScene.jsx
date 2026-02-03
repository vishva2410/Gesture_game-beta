import React, { useRef, useMemo, memo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { Box, Stars, Trail, Float, Text } from '@react-three/drei';
import Track from './Track';
import GameLogic from './GameLogic';
import { Lasers, Enemies } from './CombatElements';

// Custom hook for ship movement
const useShipMovement = (shipRef) => {
    const handPosition = useGameStore((state) => state.handPosition);
    
    useFrame((state, delta) => {
        if (!shipRef.current) return;
        
        // Clamp delta to prevent extreme jumps
        const clampedDelta = Math.min(delta, 0.1);
        
        // Map hand position to world coordinates with dead zone for stability
        const deadZone = 0.1;
        const handX = Math.abs(handPosition.x) > deadZone ? handPosition.x : 0;
        const handY = Math.abs(handPosition.y) > deadZone ? handPosition.y : 0;
        
        const targetX = handX * 12;
        const targetY = handY * 7;
        
        // Smoother movement with velocity damping
        const lerpFactor = 15 * clampedDelta;
        shipRef.current.position.x += (targetX - shipRef.current.position.x) * lerpFactor;
        shipRef.current.position.y += (targetY - shipRef.current.position.y) * lerpFactor;
        
        // Clamp position to boundaries
        shipRef.current.position.x = Math.max(-12, Math.min(12, shipRef.current.position.x));
        shipRef.current.position.y = Math.max(-8, Math.min(8, shipRef.current.position.y));
        
        // Enhanced banking with rotation limits and smoothing
        const xDiff = targetX - shipRef.current.position.x;
        const yDiff = targetY - shipRef.current.position.y;
        
        const targetRoll = -xDiff * 0.6;
        const targetPitch = -yDiff * 0.4;
        
        // Smooth rotation with limits
        shipRef.current.rotation.z += (targetRoll - shipRef.current.rotation.z) * 8 * clampedDelta;
        shipRef.current.rotation.x += (targetPitch - shipRef.current.rotation.x) * 8 * clampedDelta;
        
        // Damping to return to neutral rotation
        shipRef.current.rotation.z *= 0.95;
        shipRef.current.rotation.x *= 0.95;
    });
};

// Ship model components
const SpeedsterShip = memo(() => (
    <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow>
            <coneGeometry args={[0.5, 2, 16]} />
            <meshStandardMaterial 
                color="#ff0055" 
                emissive="#ff0055"
                emissiveIntensity={0.3}
                roughness={0.4} 
                metalness={0.6} 
            />
        </mesh>
        <pointLight position={[0, -1, 0]} color="#ff0055" intensity={1} distance={5} />
    </group>
));

const TankShip = memo(() => (
    <group>
        <mesh castShadow>
            <boxGeometry args={[1.5, 0.8, 1.5]} />
            <meshStandardMaterial 
                color="#00ff00" 
                emissive="#00ff00"
                emissiveIntensity={0.2}
                roughness={0.8} 
                metalness={0.2} 
            />
        </mesh>
        <mesh position={[-0.5, 0.5, 0.8]}>
            <sphereGeometry args={[0.3, 8, 8]} />
            <meshStandardMaterial color="#00ff00" emissive="#00ff00" />
        </mesh>
    </group>
));

const BalancedShip = memo(() => (
    <group>
        <mesh castShadow>
            <boxGeometry args={[1, 0.4, 2]} />
            <meshStandardMaterial 
                color="#00ffff" 
                emissive="#00ffff"
                emissiveIntensity={0.4}
                roughness={0.2} 
                metalness={0.8} 
            />
        </mesh>
        <mesh position={[0, 0, 1.2]}>
            <boxGeometry args={[0.2, 0.2, 0.5]} />
            <meshBasicMaterial color="orange" />
        </mesh>
        <pointLight position={[0, 0, 1.5]} color="#00ffff" intensity={0.8} distance={4} />
    </group>
));

// Main Ship component
const Ship = memo(() => {
    const shipRef = useRef();
    const selectedShip = useGameStore((state) => state.selectedShip);
    const health = useGameStore((state) => state.health);
    
    useShipMovement(shipRef);
    
    // Calculate trail color based on health
    const trailColor = useMemo(() => {
        if (health < 30) return '#ff0000';
        if (health < 60) return '#ffaa00';
        return '#00ffff';
    }, [health]);
    
    const ShipModel = useMemo(() => {
        switch(selectedShip) {
            case 'speedster': return SpeedsterShip;
            case 'tank': return TankShip;
            default: return BalancedShip;
        }
    }, [selectedShip]);
    
    return (
        <group ref={shipRef}>
            <Trail 
                width={1.5} 
                color={trailColor} 
                length={6} 
                decay={2}
                attenuation={(width) => width * 0.5}
            >
                <ShipModel />
            </Trail>
            
            {/* Health indicator when low */}
            {health < 50 && (
                <Float speed={2} rotationIntensity={1} floatIntensity={1}>
                    <Text
                        position={[0, 1.5, 0]}
                        fontSize={0.5}
                        color={health < 30 ? '#ff0000' : '#ffaa00'}
                        outlineWidth={0.02}
                        outlineColor="#000"
                    >
                        {health}%
                    </Text>
                </Float>
            )}
        </group>
    );
});

Ship.displayName = 'Ship';

// Optimized Stars component
const OptimizedStars = memo(() => (
    <Stars
        radius={100}
        depth={50}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={1}
    />
));

// Environment component
const Environment = memo(() => (
    <>
        <OptimizedStars />
        <ambientLight intensity={0.4} />
        <directionalLight 
            position={[10, 20, 5]} 
            intensity={1} 
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
        />
        <pointLight 
            position={[0, 5, 0]} 
            intensity={1.5} 
            color="purple" 
            distance={15} 
            decay={2}
        />
        <fog attach="fog" args={['#000011', 10, 50]} />
    </>
));

Environment.displayName = 'Environment';

// Performance optimization: React.memo for expensive components
const MemoizedTrack = memo(Track);
const MemoizedLasers = memo(Lasers);
const MemoizedEnemies = memo(Enemies);

// Main Game Scene
const GameScene = () => {
    const gameState = useGameStore();
    
    return (
        <Canvas 
            camera={{ 
                position: [0, 4, 10], 
                fov: 60,
                near: 0.1,
                far: 100
            }} 
            gl={{ 
                antialias: true,
                powerPreference: "high-performance",
                alpha: false
            }}
            dpr={[1, 1.5]} // Adaptive pixel ratio
            shadows
        >
            <GameLogic />
            <Environment />
            
            <MemoizedTrack />
            <MemoizedLasers />
            <MemoizedEnemies />
            <Ship />
            
            {/* Performance monitoring (development only) */}
            {process.env.NODE_ENV === 'development' && (
                <PerformanceMonitor />
            )}
        </Canvas>
    );
};

// Performance monitoring component (dev only)
const PerformanceMonitor = () => {
    const frames = useRef(0);
    const lastTime = useRef(performance.now());
    
    useFrame(() => {
        frames.current++;
        const now = performance.now();
        if (now >= lastTime.current + 1000) {
            const fps = (frames.current * 1000) / (now - lastTime.current);
            console.log(`FPS: ${fps.toFixed(1)}`);
            frames.current = 0;
            lastTime.current = now;
        }
    });
    
    return null;
};

export default memo(GameScene);