import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { MannequinConfig } from '../../data/showroomLayout';
import { getShowroomProductById, type ShowroomProduct } from '../../data/showroomProducts';

interface FashionMannequinProps {
  config: MannequinConfig;
  selected: boolean;
  productsById?: Record<string, ShowroomProduct>;
  onSelectProduct: (product: ShowroomProduct) => void;
}

export const FashionMannequin: React.FC<FashionMannequinProps> = ({
  config,
  selected,
  productsById,
  onSelectProduct,
}) => {
  const figureRef = useRef<THREE.Group | null>(null);
  const [hovered, setHovered] = useState(false);

  const product = productsById?.[config.productId] || getShowroomProductById(config.productId);
  const outfitColor = product?.colors[0]?.hex || '#8E1B28';
  const isOnCenterPodium = Math.hypot(config.position[0], config.position[2]) < 2.2;
  const baseY = isOnCenterPodium ? 0.38 : 0.14;

  useFrame((_, delta) => {
    if (!figureRef.current) return;
    if (config.turntable) {
      figureRef.current.rotation.y += delta * (hovered ? 0.65 : 0.28);
    } else if (hovered) {
      figureRef.current.rotation.y += delta * 0.45;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (product) onSelectProduct(product);
  };

  const skinColor = config.style === 'traditional' ? '#F2E7D8' : '#262335';
  const skinRoughness = config.style === 'traditional' ? 0.35 : 0.42;

  return (
    <group
      position={config.position}
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
      {/* Individual Brass Plinth if not standing on the central atrium podium */}
      {!isOnCenterPodium && (
        <group>
          <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.52, 0.56, 0.14, 28]} />
            <meshStandardMaterial color="#C89346" metalness={0.86} roughness={0.24} />
          </mesh>
          <mesh position={[0, 0.145, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.52, 0.016, 8, 32]} />
            <meshStandardMaterial
              color="#FFE4C7"
              emissive="#FF7A00"
              emissiveIntensity={hovered || selected ? 2.2 : 0.9}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {/* Composite 9-Part Human-Proportioned Sculpted Mannequin */}
      <group
        ref={figureRef}
        position={[0, baseY, 0]}
        rotation={[0, config.rotationY, 0]}
        scale={config.heightScale}
      >
        {/* Left & Right Sculpted Legs */}
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.068, 0.048, 0.88, 14]} />
            <meshStandardMaterial
              color={config.style === 'men' || config.style === 'kids' ? '#1E283D' : skinColor}
              roughness={0.75}
            />
          </mesh>
        ))}

        {/* Hips & Skirt / Couture Drape */}
        {config.style === 'traditional' ? (
          <>
            {/* Flowing Banarasi Saree Skirt */}
            <mesh position={[0, 0.52, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.42, 0.96, 24]} />
              <meshStandardMaterial
                color={outfitColor}
                roughness={0.42}
                metalness={0.22}
                emissive={hovered || selected ? '#FF7A00' : '#000000'}
                emissiveIntensity={hovered || selected ? 0.18 : 0}
              />
            </mesh>
            {/* Gold Zari Bottom Hem */}
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.39, 0.43, 0.11, 24]} />
              <meshStandardMaterial color="#D9A441" metalness={0.78} roughness={0.26} />
            </mesh>
            {/* Draped Diagonal Pallu Sash */}
            <mesh position={[0.03, 0.86, 0.11]} rotation={[0.12, 0, -0.44]} castShadow>
              <boxGeometry args={[0.14, 0.88, 0.05]} />
              <meshStandardMaterial color="#D9A441" metalness={0.72} roughness={0.28} />
            </mesh>
          </>
        ) : config.style === 'women' ? (
          /* Belted Cashmere Trench Skirt */
          <mesh position={[0, 0.64, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.28, 0.72, 20]} />
            <meshStandardMaterial
              color={outfitColor}
              roughness={0.68}
              emissive={hovered || selected ? '#FF7A00' : '#000000'}
              emissiveIntensity={hovered || selected ? 0.16 : 0}
            />
          </mesh>
        ) : (
          /* Tailored Pelvis / Trouser Block */
          <mesh position={[0, 0.88, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.17, 0.22, 16]} />
            <meshStandardMaterial color="#1E283D" roughness={0.78} />
          </mesh>
        )}

        {/* Sculpted Torso & Jacket / Bodice */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <cylinderGeometry
            args={[
              config.style === 'men' ? 0.21 : 0.18,
              config.style === 'men' ? 0.16 : 0.135,
              0.48,
              18,
            ]}
          />
          <meshStandardMaterial
            color={outfitColor}
            roughness={config.style === 'traditional' ? 0.45 : 0.68}
            metalness={config.style === 'traditional' ? 0.2 : 0.06}
            emissive={hovered || selected ? '#FF7A00' : '#000000'}
            emissiveIntensity={hovered || selected ? 0.2 : 0}
          />
        </mesh>

        {/* Shoulder Cap */}
        <mesh position={[0, 1.4, 0]} scale={[1.2, 0.55, 0.68]} castShadow>
          <sphereGeometry args={[0.19, 16, 12]} />
          <meshStandardMaterial color={outfitColor} roughness={0.65} />
        </mesh>

        {/* Left & Right Sculpted Arms */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.23, 1.12, 0.02]}
            rotation={[0.06, 0, side * 0.12]}
            castShadow
          >
            <cylinderGeometry args={[0.052, 0.04, 0.54, 12]} />
            <meshStandardMaterial
              color={config.style === 'traditional' ? skinColor : outfitColor}
              roughness={0.62}
            />
          </mesh>
        ))}

        {/* Neck */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.064, 0.12, 14]} />
          <meshStandardMaterial color={skinColor} roughness={skinRoughness} />
        </mesh>

        {/* Sculpted Boutique Mannequin Head */}
        <mesh position={[0, 1.66, 0]} scale={[0.88, 1.08, 0.94]} castShadow>
          <sphereGeometry args={[0.115, 18, 16]} />
          <meshStandardMaterial color={skinColor} roughness={skinRoughness} metalness={0.12} />
        </mesh>

        {/* Selection Halo at Feet */}
        {(hovered || selected) && (
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.38, 0.46, 32]} />
            <meshBasicMaterial color="#FF7A00" side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
    </group>
  );
};
