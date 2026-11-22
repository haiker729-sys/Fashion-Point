import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ShowroomRack } from '../../data/showroomLayout';
import { getShowroomProductById, type ShowroomProduct } from '../../data/showroomProducts';
import { ClothingItem } from './ClothingItem';

interface ClothingRackProps {
  rack: ShowroomRack;
  highlighted: boolean;
  selectedProductId: string | null;
  productsById?: Record<string, ShowroomProduct>;
  onSelectProduct: (product: ShowroomProduct) => void;
}

export const ClothingRack: React.FC<ClothingRackProps> = ({
  rack,
  highlighted,
  selectedProductId,
  productsById,
  onSelectProduct,
}) => {
  const glowMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame((state, delta) => {
    if (!glowMatRef.current) return;
    const target = highlighted
      ? 1.9 + Math.sin(state.clock.getElapsedTime() * 3) * 0.3
      : 0.25;
    glowMatRef.current.emissiveIntensity = THREE.MathUtils.damp(
      glowMatRef.current.emissiveIntensity,
      target,
      5,
      delta
    );
  });

  const isWallRail = rack.rackType === 'wall-rail';
  const railWidth = 3.5;

  return (
    <group position={rack.position} rotation={rack.rotation}>
      {/* Walnut & Brass Base Plinth */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[railWidth + 0.3, 0.16, isWallRail ? 0.78 : 0.92]} />
        <meshStandardMaterial color="#3E2A1E" roughness={0.52} metalness={0.08} />
      </mesh>

      {/* Highlight LED Edge Strip along Base (animates brightly when section is active) */}
      <mesh position={[0, 0.17, (isWallRail ? 0.78 : 0.92) / 2 - 0.02]}>
        <boxGeometry args={[railWidth + 0.22, 0.03, 0.03]} />
        <meshStandardMaterial
          ref={glowMatRef}
          color="#FFE4C7"
          emissive="#FF7A00"
          emissiveIntensity={highlighted ? 1.8 : 0.25}
          toneMapped={false}
        />
      </mesh>

      {/* Brushed Brass Vertical Uprights */}
      {[-railWidth / 2, railWidth / 2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.05, 0]} castShadow>
            <cylinderGeometry args={[0.032, 0.036, 1.95, 14]} />
            <meshStandardMaterial color="#C89346" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Decorative brass foot flange */}
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.06, 14]} />
            <meshStandardMaterial color="#1F1D2B" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Main Top Hanging Bar */}
      <mesh position={[0, 1.84, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.028, 0.028, railWidth + 0.08, 16]} />
        <meshStandardMaterial color="#D6A04E" metalness={0.94} roughness={0.18} />
      </mesh>

      {/* Upper Architectural Display Shelf with Folded Garment Stacks */}
      <mesh position={[0, 2.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[railWidth + 0.2, 0.06, 0.48]} />
        <meshStandardMaterial color="#F3E5D4" roughness={0.35} metalness={0.08} />
      </mesh>

      {/* Decorative Folded Knit Stacks on Top Shelf */}
      {[-1.1, 0, 1.1].map((x, idx) => (
        <group key={x} position={[x, 2.09, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow>
            <boxGeometry args={[0.42, 0.08, 0.3]} />
            <meshStandardMaterial
              color={idx === 0 ? '#1F1D2B' : idx === 1 ? '#C89346' : '#8E1B28'}
              roughness={0.82}
            />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow>
            <boxGeometry args={[0.38, 0.075, 0.28]} />
            <meshStandardMaterial
              color={idx === 0 ? '#FFE4C7' : idx === 1 ? '#3D4838' : '#EFE6D5'}
              roughness={0.82}
            />
          </mesh>
        </group>
      ))}

      {/* Product Slots (Reusable Phase 3 -> Phase 4 Catalog -> Phase 9 Placement Architecture) */}
      {rack.slots.map((slot) => {
        if (slot.displayStatus !== 'active' || !slot.productId) return null;
        const product =
          productsById?.[slot.productId] || getShowroomProductById(slot.productId);
        if (!product) return null;
        return (
          <ClothingItem
            key={slot.slotId}
            product={product}
            position={slot.position}
            rotation={slot.rotation}
            selected={selectedProductId === product.id}
            onSelect={onSelectProduct}
          />
        );
      })}
    </group>
  );
};
