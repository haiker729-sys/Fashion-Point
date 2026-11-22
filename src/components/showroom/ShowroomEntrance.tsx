import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { createSignageTexture } from './showroomMaterials';

interface ShowroomEntranceProps {
  doorsOpen: boolean;
}

export const ShowroomEntrance: React.FC<ShowroomEntranceProps> = ({ doorsOpen }) => {
  const leftDoorRef = useRef<THREE.Group | null>(null);
  const rightDoorRef = useRef<THREE.Group | null>(null);

  const entranceSign = useMemo(
    () => createSignageTexture('FASHION WORLD', '3D JUMMO FLAGSHIP SHOWROOM'),
    []
  );

  useEffect(() => {
    return () => {
      entranceSign.dispose();
    };
  }, [entranceSign]);

  // Smooth exponential automatic sliding door animation
  useFrame((_, delta) => {
    const targetOffset = doorsOpen ? 2.1 : 0;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = THREE.MathUtils.damp(
        leftDoorRef.current.position.x,
        -1.15 - targetOffset,
        3.2,
        delta
      );
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = THREE.MathUtils.damp(
        rightDoorRef.current.position.x,
        1.15 + targetOffset,
        3.2,
        delta
      );
    }
  });

  return (
    <group position={[0, 0, 13.8]}>
      {/* Left & Right Solid Obsidian Facade Columns */}
      <mesh position={[-9.2, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.6, 6.2, 0.5]} />
        <meshStandardMaterial color="#1F1D2B" roughness={0.5} metalness={0.35} />
      </mesh>
      <mesh position={[9.2, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.6, 6.2, 0.5]} />
        <meshStandardMaterial color="#1F1D2B" roughness={0.5} metalness={0.35} />
      </mesh>

      {/* Upper Glass Portal Fascia Header */}
      <mesh position={[0, 5.05, 0]} castShadow>
        <boxGeometry args={[9.4, 2.1, 0.56]} />
        <meshStandardMaterial color="#1F1D2B" roughness={0.45} metalness={0.4} />
      </mesh>

      {/* Illuminated Exterior & Interior Brand Signage */}
      <mesh position={[0, 5.05, 0.3]}>
        <planeGeometry args={[7.2, 1.65]} />
        <meshStandardMaterial
          map={entranceSign}
          emissive="#FFFFFF"
          emissiveMap={entranceSign}
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh position={[0, 5.05, -0.3]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[7.2, 1.65]} />
        <meshStandardMaterial
          map={entranceSign}
          emissive="#FFFFFF"
          emissiveMap={entranceSign}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Brushed Brass Portal Arch Frame */}
      {[-4.45, 4.45].map((x) => (
        <mesh key={x} position={[x, 2.0, 0]}>
          <boxGeometry args={[0.18, 4.1, 0.62]} />
          <meshStandardMaterial color="#C89346" metalness={0.92} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 4.02, 0]}>
        <boxGeometry args={[9.1, 0.16, 0.62]} />
        <meshStandardMaterial color="#C89346" metalness={0.92} roughness={0.2} />
      </mesh>

      {/* Warm Animated Accent Strip above Sliding Doors */}
      <mesh position={[0, 3.92, 0.25]}>
        <boxGeometry args={[8.4, 0.05, 0.06]} />
        <meshStandardMaterial
          color="#FFF4DF"
          emissive="#FF7A00"
          emissiveIntensity={doorsOpen ? 2.2 : 1.0}
          toneMapped={false}
        />
      </mesh>

      {/* Fixed Side Glass Panels */}
      {[-3.35, 3.35].map((x) => (
        <mesh key={x} position={[x, 1.98, 0]}>
          <boxGeometry args={[2.1, 3.92, 0.06]} />
          <meshStandardMaterial
            color="#CFE2F5"
            transparent
            opacity={0.24}
            roughness={0.08}
            metalness={0.65}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Left Automatic Sliding Glass Door */}
      <group ref={leftDoorRef} position={[-1.15, 1.98, 0.08]}>
        <mesh>
          <boxGeometry args={[2.24, 3.9, 0.06]} />
          <meshStandardMaterial
            color="#D8E8F8"
            transparent
            opacity={0.28}
            roughness={0.06}
            metalness={0.7}
            depthWrite={false}
          />
        </mesh>
        {/* Brass door stile & vertical handle */}
        <mesh position={[1.08, 0, 0]}>
          <boxGeometry args={[0.07, 3.9, 0.09]} />
          <meshStandardMaterial color="#C89346" metalness={0.92} roughness={0.2} />
        </mesh>
        <mesh position={[0.92, -0.1, 0.1]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 12]} />
          <meshStandardMaterial color="#FFA94D" metalness={0.95} roughness={0.18} />
        </mesh>
      </group>

      {/* Right Automatic Sliding Glass Door */}
      <group ref={rightDoorRef} position={[1.15, 1.98, 0.08]}>
        <mesh>
          <boxGeometry args={[2.24, 3.9, 0.06]} />
          <meshStandardMaterial
            color="#D8E8F8"
            transparent
            opacity={0.28}
            roughness={0.06}
            metalness={0.7}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-1.08, 0, 0]}>
          <boxGeometry args={[0.07, 3.9, 0.09]} />
          <meshStandardMaterial color="#C89346" metalness={0.92} roughness={0.2} />
        </mesh>
        <mesh position={[-0.92, -0.1, 0.1]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 12]} />
          <meshStandardMaterial color="#FFA94D" metalness={0.95} roughness={0.18} />
        </mesh>
      </group>
    </group>
  );
};
