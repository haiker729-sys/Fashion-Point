import React, { useEffect, useMemo } from 'react';
import { createFlutedWallTexture, createSignageTexture } from './showroomMaterials';

/**
 * Composite 6-part luxury boutique potted indoor plant (planter + soil + trunk + 3 foliage canopies).
 */
const BoutiquePlanter: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Travertine cylindrical planter */}
    <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.38, 0.3, 0.72, 20]} />
      <meshStandardMaterial color="#E6D5C0" roughness={0.55} metalness={0.05} />
    </mesh>
    {/* Brushed brass rim */}
    <mesh position={[0, 0.71, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.38, 0.02, 8, 24]} />
      <meshStandardMaterial color="#C89346" roughness={0.22} metalness={0.9} />
    </mesh>
    {/* Dark soil bed */}
    <mesh position={[0, 0.69, 0]}>
      <cylinderGeometry args={[0.34, 0.34, 0.04, 16]} />
      <meshStandardMaterial color="#2C221A" roughness={0.95} />
    </mesh>
    {/* Sculpted woody stem */}
    <mesh position={[0, 1.25, 0]} castShadow>
      <cylinderGeometry args={[0.045, 0.07, 1.15, 10]} />
      <meshStandardMaterial color="#4D3726" roughness={0.85} />
    </mesh>
    {/* Multi-layered lush foliage clusters */}
    <mesh position={[0, 1.95, 0]} castShadow>
      <dodecahedronGeometry args={[0.52, 1]} />
      <meshStandardMaterial color="#2E5436" roughness={0.72} />
    </mesh>
    <mesh position={[0.28, 1.68, 0.16]} castShadow>
      <dodecahedronGeometry args={[0.36, 1]} />
      <meshStandardMaterial color="#3A6642" roughness={0.68} />
    </mesh>
    <mesh position={[-0.25, 1.72, -0.18]} castShadow>
      <dodecahedronGeometry args={[0.34, 1]} />
      <meshStandardMaterial color="#26472E" roughness={0.75} />
    </mesh>
  </group>
);

/**
 * Full-height brass-framed luxury dressing mirror.
 */
const BoutiqueMirror: React.FC<{
  position: [number, number, number];
  rotationY?: number;
}> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    {/* Brushed gold outer frame */}
    <mesh position={[0, 1.65, 0]} castShadow>
      <boxGeometry args={[1.45, 3.1, 0.08]} />
      <meshStandardMaterial color="#C89346" metalness={0.9} roughness={0.22} />
    </mesh>
    {/* High-metalness reflective mirror pane */}
    <mesh position={[0, 1.65, 0.046]}>
      <planeGeometry args={[1.28, 2.92]} />
      <meshStandardMaterial color="#F2EFEA" metalness={0.96} roughness={0.04} envMapIntensity={1.6} />
    </mesh>
  </group>
);

/**
 * Plush luxury lounge ottoman with brass base.
 */
const LuxuryOttoman: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.62, 0.65, 0.16, 28]} />
      <meshStandardMaterial color="#C89346" metalness={0.88} roughness={0.26} />
    </mesh>
    <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.68, 0.68, 0.36, 28]} />
      <meshStandardMaterial color="#36324A" roughness={0.82} metalness={0.05} />
    </mesh>
    <mesh position={[0, 0.5, 0]}>
      <cylinderGeometry args={[0.64, 0.68, 0.05, 28]} />
      <meshStandardMaterial color="#46405E" roughness={0.78} />
    </mesh>
  </group>
);

export const ShowroomWalls: React.FC = () => {
  const flutedMap = useMemo(() => createFlutedWallTexture(), []);
  const atriumSign = useMemo(
    () => createSignageTexture('FASHION WORLD', 'TRADITIONAL HERITAGE & COUTURE'),
    []
  );
  const menSign = useMemo(
    () => createSignageTexture("MEN'S COLLECTION", 'TAILORED SUITING · SHIRTS · DENIM'),
    []
  );
  const womenSign = useMemo(
    () => createSignageTexture("WOMEN'S ATELIER", 'CASHMERE OUTERWEAR · COUTURE'),
    []
  );
  const checkoutSign = useMemo(
    () => createSignageTexture('CHECKOUT & CONCIERGE', 'EXPRESS ASSISTANCE · PHASE 5 CHECKOUT', '#2563EB'),
    []
  );

  useEffect(() => {
    return () => {
      flutedMap.dispose();
      atriumSign.dispose();
      menSign.dispose();
      womenSign.dispose();
      checkoutSign.dispose();
    };
  }, [flutedMap, atriumSign, menSign, womenSign, checkoutSign]);

  return (
    <group>
      {/* Back North Wall */}
      <mesh position={[0, 3, -13.5]} receiveShadow>
        <boxGeometry args={[28, 6.2, 0.4]} />
        <meshStandardMaterial map={flutedMap} roughness={0.58} metalness={0.25} />
      </mesh>

      {/* Left West Wall */}
      <mesh position={[-13.8, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6.2, 28]} />
        <meshStandardMaterial map={flutedMap} roughness={0.58} metalness={0.25} />
      </mesh>

      {/* Right East Wall */}
      <mesh position={[13.8, 3, 0]} receiveShadow>
        <boxGeometry args={[0.4, 6.2, 28]} />
        <meshStandardMaterial map={flutedMap} roughness={0.58} metalness={0.25} />
      </mesh>

      {/* Architectural Coffered Ceiling */}
      <mesh position={[0, 6.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28.4, 28.4]} />
        <meshStandardMaterial color="#1F1D2B" roughness={0.8} metalness={0.15} />
      </mesh>

      {/* Warm Travertine Feature Alcove Panels behind Racks */}
      {[
        { pos: [-13.45, 2.7, -1.6] as [number, number, number], rotY: Math.PI / 2, w: 6.2 },
        { pos: [13.45, 2.7, -1.6] as [number, number, number], rotY: -Math.PI / 2, w: 6.2 },
        { pos: [0, 2.7, -13.2] as [number, number, number], rotY: 0, w: 8.6 },
      ].map((panel, i) => (
        <mesh key={i} position={panel.pos} rotation={[0, panel.rotY, 0]} receiveShadow>
          <boxGeometry args={[panel.w, 4.6, 0.14]} />
          <meshStandardMaterial color="#EFE0CE" roughness={0.52} metalness={0.05} />
        </mesh>
      ))}

      {/* Backlit Department Signage Plaques */}
      <mesh position={[0, 4.55, -13.08]}>
        <planeGeometry args={[6.4, 1.55]} />
        <meshStandardMaterial map={atriumSign} emissive="#FFFFFF" emissiveMap={atriumSign} emissiveIntensity={0.38} />
      </mesh>
      <mesh position={[-13.34, 4.55, -1.6]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5.2, 1.25]} />
        <meshStandardMaterial map={menSign} emissive="#FFFFFF" emissiveMap={menSign} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[13.34, 4.55, -1.6]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[5.2, 1.25]} />
        <meshStandardMaterial map={womenSign} emissive="#FFFFFF" emissiveMap={womenSign} emissiveIntensity={0.35} />
      </mesh>

      {/* Checkout Information Point — Luxury Marble & Brass Concierge Desk (North-East) */}
      <group position={[9.8, 0, -9.4]} rotation={[0, -Math.PI / 4, 0]}>
        {/* Main marble counter body */}
        <mesh position={[0, 0.56, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 1.12, 1.1]} />
          <meshStandardMaterial color="#F4E7D7" roughness={0.28} metalness={0.08} />
        </mesh>
        {/* Obsidian fluted front accent */}
        <mesh position={[0, 0.5, 0.56]}>
          <boxGeometry args={[3.1, 0.84, 0.05]} />
          <meshStandardMaterial color="#1F1D2B" roughness={0.5} metalness={0.3} />
        </mesh>
        {/* Brushed brass countertop & plinth trim */}
        <mesh position={[0, 1.14, 0]} castShadow>
          <boxGeometry args={[3.5, 0.06, 1.18]} />
          <meshStandardMaterial color="#C89346" metalness={0.9} roughness={0.22} />
        </mesh>
        {/* Sleek POS display monitor */}
        <mesh position={[0, 1.42, 0.05]} rotation={[-0.18, 0, 0]} castShadow>
          <boxGeometry args={[0.72, 0.44, 0.04]} />
          <meshStandardMaterial color="#1F1D2B" roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.42, 0.075]} rotation={[-0.18, 0, 0]}>
          <planeGeometry args={[0.64, 0.36]} />
          <meshStandardMaterial color="#2563EB" emissive="#2563EB" emissiveIntensity={0.75} />
        </mesh>
        {/* Overhead Checkout Information Sign */}
        <mesh position={[0, 2.75, -0.4]}>
          <planeGeometry args={[3.8, 0.95]} />
          <meshStandardMaterial
            map={checkoutSign}
            emissive="#FFFFFF"
            emissiveMap={checkoutSign}
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* Full-Height Mirrors */}
      <BoutiqueMirror position={[-13.4, 0, 4.4]} rotationY={Math.PI / 2} />
      <BoutiqueMirror position={[13.4, 0, 4.4]} rotationY={-Math.PI / 2} />
      <BoutiqueMirror position={[-5.2, 0, -13.2]} rotationY={0} />

      {/* Decorative Luxury Potted Plants */}
      <BoutiquePlanter position={[-5.4, 0, 12.1]} />
      <BoutiquePlanter position={[5.4, 0, 12.1]} />
      <BoutiquePlanter position={[-12.2, 0, -12.0]} />
      <BoutiquePlanter position={[12.2, 0, -5.2]} />

      {/* Plush Seating Ottomans */}
      <LuxuryOttoman position={[-4.8, 0, 3.8]} />
      <LuxuryOttoman position={[4.8, 0, 3.8]} />
    </group>
  );
};
