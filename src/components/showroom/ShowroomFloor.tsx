import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { createMarbleFloorTexture } from './showroomMaterials';
import { resolveShowroomCollision } from '../../data/showroomLayout';

interface ShowroomFloorProps {
  clickTarget: [number, number, number] | null;
  onFloorClick: (x: number, z: number) => void;
}

export const ShowroomFloor: React.FC<ShowroomFloorProps> = ({ clickTarget, onFloorClick }) => {
  const marbleMap = useMemo(() => createMarbleFloorTexture(), []);
  const markerRef = useRef<THREE.Mesh | null>(null);

  useEffect(() => {
    return () => {
      marbleMap.dispose();
    };
  }, [marbleMap]);

  useFrame((state) => {
    if (markerRef.current) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 4) * 0.12;
      markerRef.current.scale.set(s, s, 1);
    }
  });

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    // Only treat short clicks (not camera drags) as click-to-move
    if (e.delta > 6) return;
    e.stopPropagation();
    const [tx, tz] = resolveShowroomCollision(e.point.x, e.point.z);
    onFloorClick(tx, tz);
  };

  return (
    <group>
      {/* Main Polished Crema Marfil Marble Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 1]}
        receiveShadow
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[28, 32]} />
        <meshStandardMaterial
          map={marbleMap}
          roughness={0.22}
          metalness={0.08}
          envMapIntensity={1.1}
        />
      </mesh>

      {/* Exterior Arrival Promenade Floor outside the Glass Doors */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 19]} receiveShadow>
        <planeGeometry args={[30, 10]} />
        <meshStandardMaterial color="#272436" roughness={0.65} metalness={0.1} />
      </mesh>

      {/* Recessed Brushed Brass Runway Guide Strips (Offset +0.015 to avoid Z-fighting) */}
      {[-3.2, 3.2].map((x) => (
        <mesh key={x} position={[x, 0.012, 4.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 17]} />
          <meshStandardMaterial color="#D49B4B" metalness={0.88} roughness={0.26} />
        </mesh>
      ))}

      {/* Central Illuminated Circular Brushed-Brass Mannequin Podium */}
      <group position={[0, 0, 0]}>
        {/* Lower obsidian plinth shadow trim */}
        <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.35, 2.45, 0.1, 48]} />
          <meshStandardMaterial color="#1F1D2B" roughness={0.45} metalness={0.4} />
        </mesh>
        {/* Perimeter glowing amber LED strip */}
        <mesh position={[0, 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.36, 0.03, 10, 56]} />
          <meshStandardMaterial
            color="#FFE4C7"
            emissive="#FF7A00"
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
        {/* Main brushed gold stage */}
        <mesh position={[0, 0.24, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[2.22, 2.28, 0.26, 48]} />
          <meshStandardMaterial color="#C89346" roughness={0.24} metalness={0.86} />
        </mesh>
        {/* Top ivory marble insert */}
        <mesh position={[0, 0.375, 0]} receiveShadow>
          <cylinderGeometry args={[2.02, 2.02, 0.02, 48]} />
          <meshStandardMaterial color="#FFF4E6" roughness={0.22} metalness={0.08} />
        </mesh>
      </group>

      {/* Interactive Click-To-Move Floor Target Ring */}
      {clickTarget && (
        <mesh
          ref={markerRef}
          position={[clickTarget[0], 0.025, clickTarget[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.24, 0.34, 32]} />
          <meshBasicMaterial color="#FF7A00" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
