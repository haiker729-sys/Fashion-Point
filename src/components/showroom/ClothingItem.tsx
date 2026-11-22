import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { GarmentArchetype, ShowroomProduct } from '../../data/showroomProducts';

interface GarmentMeshModelProps {
  archetype: GarmentArchetype;
  colorHex: string;
  accentHex?: string;
  highlighted?: boolean;
  scale?: number;
}

/**
 * Reusable composite 3D procedural garment mesh (5–9 distinct parts per silhouette)
 * used both on showroom racks and inside the dedicated 360° ProductViewer.
 */
export const GarmentMeshModel: React.FC<GarmentMeshModelProps> = ({
  archetype,
  colorHex,
  accentHex = '#C89346',
  highlighted = false,
  scale = 1,
}) => {
  const emissive = highlighted ? '#FF7A00' : '#000000';
  const emissiveIntensity = highlighted ? 0.22 : 0;

  return (
    <group scale={scale}>
      {/* Sculpted Walnut & Brass Hanger (top pivot) */}
      <group position={[0, 0.04, 0]}>
        {/* Brass hook */}
        <mesh position={[0, 0.08, 0]} rotation={[0, 0, Math.PI * 0.15]}>
          <torusGeometry args={[0.042, 0.008, 8, 18, Math.PI * 1.4]} />
          <meshStandardMaterial color="#D49B4B" metalness={0.92} roughness={0.2} />
        </mesh>
        {/* Walnut shoulder arms */}
        <mesh position={[-0.14, -0.02, 0]} rotation={[0, 0, 0.34]}>
          <boxGeometry args={[0.3, 0.026, 0.03]} />
          <meshStandardMaterial color="#593A25" roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0.14, -0.02, 0]} rotation={[0, 0, -0.34]}>
          <boxGeometry args={[0.3, 0.026, 0.03]} />
          <meshStandardMaterial color="#593A25" roughness={0.55} metalness={0.05} />
        </mesh>
      </group>

      {archetype === 'jeans' ? (
        /* Tailored Selvedge Denim Trousers */
        <group position={[0, -0.1, 0]}>
          {/* Waistband */}
          <mesh position={[0, -0.04, 0]} castShadow>
            <boxGeometry args={[0.42, 0.14, 0.14]} />
            <meshStandardMaterial
              color={colorHex}
              roughness={0.85}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Brass button */}
          <mesh position={[0, -0.02, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.015, 12]} />
            <meshStandardMaterial color={accentHex} metalness={0.9} roughness={0.25} />
          </mesh>
          {/* Left & Right tapered legs */}
          <mesh position={[-0.11, -0.48, 0]} castShadow>
            <cylinderGeometry args={[0.095, 0.078, 0.78, 14]} />
            <meshStandardMaterial
              color={colorHex}
              roughness={0.86}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          <mesh position={[0.11, -0.48, 0]} castShadow>
            <cylinderGeometry args={[0.095, 0.078, 0.78, 14]} />
            <meshStandardMaterial
              color={colorHex}
              roughness={0.86}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Selvedge folded cuffs */}
          {[-0.11, 0.11].map((x) => (
            <mesh key={x} position={[x, -0.87, 0]}>
              <cylinderGeometry args={[0.082, 0.082, 0.07, 14]} />
              <meshStandardMaterial color="#B5C2D1" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ) : archetype === 'saree' ? (
        /* Draped Banarasi Zari Silk Saree Silhouette */
        <group position={[0, -0.1, 0]}>
          {/* Fitted couture blouse bodice */}
          <mesh position={[0, -0.16, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.14, 0.3, 18]} />
            <meshStandardMaterial
              color={colorHex}
              roughness={0.45}
              metalness={0.18}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Flowing pleated silk skirt drape */}
          <mesh position={[0, -0.68, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.34, 0.78, 22]} />
            <meshStandardMaterial
              color={colorHex}
              roughness={0.42}
              metalness={0.2}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
          {/* Diagonal antique-gold zari pallu sash */}
          <mesh position={[0.02, -0.42, 0.12]} rotation={[0.08, 0, -0.45]} castShadow>
            <boxGeometry args={[0.16, 0.84, 0.05]} />
            <meshStandardMaterial color="#D4A048" roughness={0.32} metalness={0.72} />
          </mesh>
          {/* Golden woven hem border */}
          <mesh position={[0, -1.03, 0]}>
            <cylinderGeometry args={[0.33, 0.35, 0.09, 22]} />
            <meshStandardMaterial color="#D4A048" roughness={0.3} metalness={0.76} />
          </mesh>
        </group>
      ) : (
        /* Tailored Upperwear / Coats / Blazers / Shirts / Kurtis / Sherwanis / T-Shirts */
        <group position={[0, -0.06, 0]}>
          {/* Collar / Mandarin neckband */}
          <mesh position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.095, 0.11, 0.08, 16]} />
            <meshStandardMaterial color={colorHex} roughness={0.62} />
          </mesh>

          {/* Main sculpted torso body */}
          <mesh
            position={[
              0,
              archetype === 'coat' || archetype === 'kurti' || archetype === 'sherwani'
                ? -0.48
                : -0.34,
              0,
            ]}
            castShadow
          >
            <boxGeometry
              args={[
                archetype === 'kids-jacket' ? 0.42 : 0.48,
                archetype === 'coat'
                  ? 0.94
                  : archetype === 'kurti' || archetype === 'sherwani'
                    ? 0.86
                    : 0.62,
                0.15,
              ]}
            />
            <meshStandardMaterial
              color={colorHex}
              roughness={archetype === 'sherwani' || archetype === 'kurti' ? 0.48 : 0.72}
              metalness={archetype === 'sherwani' ? 0.18 : 0.05}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>

          {/* Left & Right Tailored Sleeves */}
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                side * (archetype === 'kids-jacket' ? 0.26 : 0.3),
                archetype === 'tshirt' ? -0.19 : -0.33,
                0,
              ]}
              rotation={[0, 0, side * 0.14]}
              castShadow
            >
              <cylinderGeometry
                args={[
                  0.072,
                  archetype === 'tshirt' ? 0.068 : 0.056,
                  archetype === 'tshirt' ? 0.24 : 0.56,
                  12,
                ]}
              />
              <meshStandardMaterial
                color={colorHex}
                roughness={0.72}
                emissive={emissive}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
          ))}

          {/* Lapels / Placket / Embroidery / Belt Details */}
          {(archetype === 'blazer' || archetype === 'coat') && (
            <>
              <mesh position={[-0.08, -0.19, 0.082]} rotation={[0, 0, 0.24]}>
                <boxGeometry args={[0.075, 0.28, 0.02]} />
                <meshStandardMaterial color={colorHex} roughness={0.58} />
              </mesh>
              <mesh position={[0.08, -0.19, 0.082]} rotation={[0, 0, -0.24]}>
                <boxGeometry args={[0.075, 0.28, 0.02]} />
                <meshStandardMaterial color={colorHex} roughness={0.58} />
              </mesh>
              {/* Pocket square / belt accent */}
              {archetype === 'blazer' ? (
                <mesh position={[0.12, -0.22, 0.084]} rotation={[0, 0, -0.18]}>
                  <boxGeometry args={[0.06, 0.04, 0.015]} />
                  <meshStandardMaterial color="#FF7A00" roughness={0.45} />
                </mesh>
              ) : (
                <mesh position={[0, -0.45, 0]}>
                  <boxGeometry args={[0.5, 0.065, 0.175]} />
                  <meshStandardMaterial color={colorHex} roughness={0.6} />
                </mesh>
              )}
            </>
          )}

          {/* Button placket or embroidered zari strip */}
          {(archetype === 'shirt' ||
            archetype === 'sherwani' ||
            archetype === 'kurti' ||
            archetype === 'kids-jacket') && (
            <group>
              <mesh position={[0, -0.34, 0.08]}>
                <boxGeometry
                  args={[
                    archetype === 'sherwani' || archetype === 'kurti' ? 0.085 : 0.028,
                    archetype === 'sherwani' || archetype === 'kurti' ? 0.68 : 0.54,
                    0.014,
                  ]}
                />
                <meshStandardMaterial
                  color={
                    archetype === 'sherwani' || archetype === 'kurti' ? '#D4A048' : accentHex
                  }
                  metalness={archetype === 'sherwani' ? 0.72 : 0.35}
                  roughness={0.35}
                />
              </mesh>
              {[-0.15, -0.27, -0.39, -0.51].map((yPos) => (
                <mesh key={yPos} position={[0, yPos, 0.092]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.012, 10]} />
                  <meshStandardMaterial color="#E6C285" metalness={0.85} roughness={0.22} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      )}
    </group>
  );
};

interface ClothingItemProps {
  product: ShowroomProduct;
  position: [number, number, number];
  rotation?: [number, number, number];
  selected: boolean;
  onSelect: (product: ShowroomProduct) => void;
}

export const ClothingItem: React.FC<ClothingItemProps> = ({
  product,
  position,
  rotation = [0, 0, 0],
  selected,
  onSelect,
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState(false);

  const primaryColor = product.colors[0]?.hex || '#1F1D2B';

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const targetY = position[1] + (hovered || selected ? 0.06 : 0);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetY, 8, delta);

    const targetSwing = hovered
      ? Math.sin(state.clock.getElapsedTime() * 3.5) * 0.055
      : selected
        ? Math.sin(state.clock.getElapsedTime() * 2.2) * 0.03
        : 0;
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, targetSwing, 6, delta);
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(product);
  };

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <GarmentMeshModel
        archetype={product.modelRef}
        colorHex={primaryColor}
        highlighted={hovered || selected}
        scale={product.garmentScale}
      />

      {/* Selection / Hover Ground Ring Aura */}
      {(hovered || selected) && (
        <mesh position={[0, -1.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.34, 24]} />
          <meshBasicMaterial
            color={selected ? '#FF7A00' : '#FFA94D'}
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
};
