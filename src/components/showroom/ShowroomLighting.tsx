import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface ShowroomLightingProps {
  shadowsEnabled: boolean;
  shadowMapSize: number;
  doorsOpen: boolean;
}

export const ShowroomLighting: React.FC<ShowroomLightingProps> = ({
  shadowsEnabled,
  shadowMapSize,
  doorsOpen,
}) => {
  const { gl, scene } = useThree();
  const ring1Ref = useRef<THREE.MeshStandardMaterial | null>(null);
  const ring2Ref = useRef<THREE.MeshStandardMaterial | null>(null);
  const ring3Ref = useRef<THREE.MeshStandardMaterial | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Mandatory Studio Environment Reflections (PMREM RoomEnvironment) on all devices
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.72;
    envScene.dispose();
    pmrem.dispose();

    return () => {
      envRT.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  // Subtle architectural lighting warm-up & breathing animation
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const targetEmissive = doorsOpen ? 1.85 : 1.25;
    const pulse = Math.sin(t * 1.1) * 0.14;

    if (ring1Ref.current) {
      ring1Ref.current.emissiveIntensity = THREE.MathUtils.damp(
        ring1Ref.current.emissiveIntensity,
        targetEmissive + pulse,
        3,
        delta
      );
    }
    if (ring2Ref.current) {
      ring2Ref.current.emissiveIntensity = THREE.MathUtils.damp(
        ring2Ref.current.emissiveIntensity,
        targetEmissive * 0.92 - pulse * 0.7,
        3,
        delta
      );
    }
    if (ring3Ref.current) {
      ring3Ref.current.emissiveIntensity = THREE.MathUtils.damp(
        ring3Ref.current.emissiveIntensity,
        targetEmissive * 1.05 + pulse * 0.5,
        3,
        delta
      );
    }
    if (keyLightRef.current) {
      keyLightRef.current.intensity = THREE.MathUtils.damp(
        keyLightRef.current.intensity,
        doorsOpen ? 2.1 : 1.45,
        2.5,
        delta
      );
    }
  });

  const chandelierRings = [
    { radius: 4.5, tube: 0.1, y: 5.55, ref: ring1Ref },
    { radius: 3.1, tube: 0.09, y: 5.3, ref: ring2Ref },
    { radius: 1.8, tube: 0.08, y: 5.05, ref: ring3Ref },
  ];

  return (
    <group>
      {/* Warm/Cool Balanced Fill */}
      <hemisphereLight args={['#FFF4E6', '#2A2538', 0.95]} />

      {/* Main Warm Gallery Key Light with Tight Shadow Frustum */}
      <directionalLight
        ref={keyLightRef}
        position={[6, 11, 7]}
        intensity={1.9}
        color="#FFF1DC"
        castShadow={shadowsEnabled}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={34}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0005}
        shadow-normalBias={0.025}
      />

      {/* Cool Architectural Rim / Backlight */}
      <directionalLight position={[-8, 8, -10]} intensity={0.65} color="#DCE8FF" />

      {/* Focused Interior Accent Point Lights (No Shadow Cost for High Mobile FPS) */}
      <pointLight position={[0, 4.9, 0]} intensity={16} distance={15} decay={2} color="#FFD7A3" />
      <pointLight position={[-9, 4.3, 0]} intensity={10} distance={13} decay={2} color="#FFE4C7" />
      <pointLight position={[9, 4.3, 0]} intensity={10} distance={13} decay={2} color="#FFE4C7" />
      <pointLight position={[0, 4.4, -10]} intensity={11} distance={14} decay={2} color="#FFD29B" />

      {/* Signature Concentric Circular Luxury LED Chandelier Rings */}
      <group position={[0, 0, 0]}>
        {/* Dark recessed ceiling oculus */}
        <mesh position={[0, 5.92, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[5.4, 48]} />
          <meshStandardMaterial color="#161420" roughness={0.85} metalness={0.2} />
        </mesh>

        {chandelierRings.map((ring, idx) => (
          <group key={idx} position={[0, ring.y, 0]}>
            {/* Brushed brass outer casing */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[ring.radius, ring.tube * 1.15, 12, 64]} />
              <meshStandardMaterial color="#C89143" roughness={0.25} metalness={0.9} />
            </mesh>
            {/* Glowing warm LED diffuser ring */}
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[ring.radius, ring.tube * 0.72, 12, 64]} />
              <meshStandardMaterial
                ref={ring.ref}
                color="#FFF4DF"
                emissive="#FFA94D"
                emissiveIntensity={1.6}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Perimeter Linear Cove LED Strips along Left & Right Wings */}
      {[-11.8, 11.8].map((xPos) => (
        <mesh key={xPos} position={[xPos, 5.65, 0]}>
          <boxGeometry args={[0.14, 0.08, 24]} />
          <meshStandardMaterial
            color="#FFF5E6"
            emissive="#FFA94D"
            emissiveIntensity={1.35}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
};
