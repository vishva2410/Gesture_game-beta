import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { Instances, Billboard } from '@react-three/drei';
import * as THREE from 'three';

const getLaserStyle = (laser) => {
  if (laser.color) return { color: laser.color, length: 1.6 };
  switch (laser.type) {
    case 'enemy':
      return { color: '#ff4444', length: 1.4 };
    case 'boss':
      return { color: '#ff00ff', length: 2.2 };
    case 'charged':
      return { color: '#00ffff', length: 2.0 };
    default:
      return { color: '#ffff00', length: 1.4 };
  }
};

const getEnemyStyle = (enemy) => {
  if (enemy.type === 'tank') {
    return { size: 2.1, color: '#ff3355' };
  }
  return { size: 1.3, color: '#ff7777' };
};

export const Lasers = () => {
  const lasers = useGameStore((state) => state.lasers);
  const instRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!instRef.current) return;

    lasers.forEach((laser, i) => {
      const style = getLaserStyle(laser);
      color.set(style.color);

      dummy.position.set(laser.x, laser.y, laser.z);
      dummy.rotation.x = Math.PI / 2;
      dummy.scale.set(1, style.length, 1);
      dummy.updateMatrix();

      instRef.current.setMatrixAt(i, dummy.matrix);
      instRef.current.setColorAt(i, color);
    });

    instRef.current.count = lasers.length;
    instRef.current.instanceMatrix.needsUpdate = true;
    if (instRef.current.instanceColor) {
      instRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <Instances ref={instRef} limit={300} range={lasers.length}>
      <cylinderGeometry args={[0.08, 0.08, 1.4, 8]} />
      <meshBasicMaterial vertexColors toneMapped={false} />
    </Instances>
  );
};

export const Enemies = () => {
  const enemies = useGameStore((state) => state.enemies);
  const instRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    if (!instRef.current) return;
    const time = state.clock.elapsedTime;

    enemies.forEach((enemy, i) => {
      const style = getEnemyStyle(enemy);
      const seed = Math.sin(enemy.id * 1000) * 2;
      const bob = Math.sin(time * 2 + seed) * 0.4;

      color.set(style.color);

      dummy.position.set(enemy.x, enemy.y + bob, enemy.z);
      dummy.rotation.y = time * 0.6 + seed;
      dummy.scale.setScalar(style.size);
      dummy.updateMatrix();

      instRef.current.setMatrixAt(i, dummy.matrix);
      instRef.current.setColorAt(i, color);
    });

    instRef.current.count = enemies.length;
    instRef.current.instanceMatrix.needsUpdate = true;
    if (instRef.current.instanceColor) {
      instRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <Instances ref={instRef} limit={200} range={enemies.length}>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshStandardMaterial
          vertexColors
          metalness={0.7}
          roughness={0.3}
          emissive="#550000"
          emissiveIntensity={0.4}
        />
      </Instances>

      {enemies.map((enemy) => {
        const style = getEnemyStyle(enemy);
        const healthRatio = enemy.maxHealth ? enemy.health / enemy.maxHealth : 1;
        return (
          <Billboard key={`enemy-hp-${enemy.id}`} position={[enemy.x, enemy.y + style.size * 1.4, enemy.z]}>
            <group>
              <mesh>
                <boxGeometry args={[style.size, 0.12, 0.1]} />
                <meshBasicMaterial color="#222" />
              </mesh>
              <mesh position={[-(style.size / 2) * (1 - healthRatio), 0, 0.02]}>
                <boxGeometry args={[style.size * healthRatio, 0.08, 0.1]} />
                <meshBasicMaterial color={healthRatio > 0.5 ? '#00ff88' : '#ff4444'} />
              </mesh>
            </group>
          </Billboard>
        );
      })}
    </>
  );
};

export const Boss = () => {
  const boss = useGameStore((state) => state.boss);
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current || !boss) return;
    const time = state.clock.elapsedTime;
    ref.current.position.set(boss.x, boss.y + Math.sin(time) * 0.6, boss.z);
    ref.current.rotation.y = time * 0.4;
  });

  if (!boss) return null;

  const healthRatio = boss.maxHealth ? boss.health / boss.maxHealth : 1;

  return (
    <group ref={ref}>
      <mesh>
        <torusKnotGeometry args={[3.2, 1.1, 120, 16]} />
        <meshStandardMaterial
          color="#ff00ff"
          emissive="#ff00ff"
          emissiveIntensity={0.6}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      <Billboard position={[0, 5, 0]}>
        <group>
          <mesh>
            <boxGeometry args={[6, 0.3, 0.2]} />
            <meshBasicMaterial color="#222" />
          </mesh>
          <mesh position={[-3 * (1 - healthRatio), 0, 0.02]}>
            <boxGeometry args={[6 * healthRatio, 0.22, 0.2]} />
            <meshBasicMaterial color={healthRatio > 0.5 ? '#00ffff' : '#ff4444'} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
};

// Legacy exports kept for compatibility
export const EnemyVariants = {
  SCOUT: { size: 0.8, speed: 2, health: 50, rotationSpeed: 0.5, color: '#ff6666', behavior: 'evasive' },
  FIGHTER: { size: 1.2, speed: 1.5, health: 100, rotationSpeed: 0.3, color: '#ff3333', behavior: 'aggressive' },
  CRUISER: { size: 2, speed: 0.8, health: 300, rotationSpeed: 0.1, color: '#ff0000', behavior: 'tank' },
  BOSS: { size: 4, speed: 0.3, health: 2000, rotationSpeed: 0.05, color: '#990000', behavior: 'boss' }
};

export const EnemySpawner = () => null;
