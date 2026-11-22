import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Box,
  Heart,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  ShoppingBag,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { ShowroomProduct } from '../../data/showroomProducts';
import { useStore } from '../../context/StoreContext';
import { GarmentMeshModel } from './ClothingItem';
import {
  Button,
  PriceDisplay,
  ProductBadge,
  RatingDisplay,
  ResilientImage,
  StockStatusLabel,
} from '../ui/Primitives';
import { Modal } from '../ui/Overlays';

interface ViewerSceneProps {
  product: ShowroomProduct;
  colorHex: string;
  autoSpin: boolean;
  zoomDist: number;
  resetSignal: number;
}

const ProductStudioScene: React.FC<ViewerSceneProps> = ({
  product,
  colorHex,
  autoSpin,
  zoomDist,
  resetSignal,
}) => {
  const { gl, scene, camera } = useThree();
  const pivotRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<{ reset: () => void } | null>(null);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    envScene.dispose();
    pmrem.dispose();
    return () => {
      envRT.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);

  useEffect(() => {
    if (resetSignal > 0) {
      camera.position.set(0, 0.1, 2.25);
      controlsRef.current?.reset();
    }
  }, [resetSignal, camera]);

  useFrame((_, delta) => {
    if (pivotRef.current && autoSpin) {
      pivotRef.current.rotation.y += delta * 0.65;
    }
    const currentLen = camera.position.length();
    if (Math.abs(currentLen - zoomDist) > 0.03) {
      const nextLen = THREE.MathUtils.damp(currentLen, zoomDist, 7, delta);
      camera.position.setLength(nextLen);
    }
  });

  return (
    <>
      <color attach="background" args={['#F7EFE4']} />
      <hemisphereLight args={['#FFF8EF', '#2B273A', 1.0]} />
      <directionalLight position={[3, 4, 4]} intensity={1.8} color="#FFF3E0" />
      <directionalLight position={[-3, 2, -3]} intensity={0.75} color="#DCE8FF" />

      {/* Grounding Turntable Disc */}
      <mesh position={[0, -0.78, 0]} receiveShadow>
        <cylinderGeometry args={[0.72, 0.78, 0.08, 40]} />
        <meshStandardMaterial color="#C89346" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.735, 0]}>
        <cylinderGeometry args={[0.64, 0.64, 0.015, 40]} />
        <meshStandardMaterial color="#FFF8EF" roughness={0.28} />
      </mesh>

      <group ref={pivotRef} position={[0, 0.45, 0]}>
        <GarmentMeshModel
          archetype={product.modelRef}
          colorHex={colorHex}
          scale={product.garmentScale * 1.15}
        />
      </group>

      <OrbitControls
        ref={controlsRef as never}
        enablePan={false}
        minDistance={1.35}
        maxDistance={3.4}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
};

interface ProductViewerProps {
  product: ShowroomProduct | null;
  webglSupported: boolean;
  onClose: () => void;
}

export const ProductViewer: React.FC<ProductViewerProps> = ({
  product,
  webglSupported,
  onClose,
}) => {
  const { wishlistIds, toggleWishlist, addToCart } = useStore();
  const [viewMode, setViewMode] = useState<'3d' | 'photo'>('3d');
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [autoSpin, setAutoSpin] = useState(true);
  const [zoomDist, setZoomDist] = useState(2.25);
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    if (!product) return;
    setSelectedColorIdx(0);
    setSelectedSize(product.sizes[Math.min(1, product.sizes.length - 1)]);
    setViewMode(webglSupported && product.has3DModel ? '3d' : 'photo');
    setZoomDist(2.25);
    setAutoSpin(true);
  }, [product, webglSupported]);

  if (!product) return null;

  const activeColor = product.colors[selectedColorIdx] || product.colors[0];
  const isWishlisted = wishlistIds.includes(product.id);
  const canRender3D = webglSupported && product.has3DModel;

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product.name}
      subtitle={`${product.sku} · ${product.showroomZone} · Phase 3 Demo Product`}
      maxWidth="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive 360° 3D Viewport / Studio Image Fallback */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-[4/3] sm:aspect-[16/12] w-full overflow-hidden rounded-2xl border border-[#1F1D2B]/12 bg-[#F7EFE4]">
            {viewMode === '3d' && canRender3D ? (
              <Canvas
                dpr={[1, 1.5]}
                camera={{ fov: 42, position: [0, 0.1, 2.25] }}
                gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
              >
                <ProductStudioScene
                  product={product}
                  colorHex={activeColor?.hex || '#1F1D2B'}
                  autoSpin={autoSpin}
                  zoomDist={zoomDist}
                  resetSignal={resetSignal}
                />
              </Canvas>
            ) : (
              <div className="relative h-full w-full flex items-center justify-center bg-[#FFF8EF]">
                <ResilientImage
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-contain p-3"
                />
                {!canRender3D && (
                  <div className="absolute bottom-3 left-3 rounded-lg bg-[#1F1D2B]/88 px-3 py-1.5 text-xs font-medium text-[#FFF8EF]">
                    Studio Image Fallback (3D WebGL unavailable on this device)
                  </div>
                )}
              </div>
            )}

            {/* Top View Switcher Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-xl bg-[#1F1D2B]/90 p-1 text-xs">
              {canRender3D && (
                <button
                  type="button"
                  onClick={() => setViewMode('3d')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer ${
                    viewMode === '3d'
                      ? 'bg-[#FF7A00] text-white'
                      : 'text-[#FFF8EF]/80 hover:text-white'
                  }`}
                >
                  <Box className="h-3.5 w-3.5" />
                  360° 3D Model
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('photo')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer ${
                  viewMode === 'photo'
                    ? 'bg-[#FF7A00] text-white'
                    : 'text-[#FFF8EF]/80 hover:text-white'
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Studio Photo
              </button>
            </div>

            {/* Bottom 3D Controls Bar */}
            {viewMode === '3d' && canRender3D && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-lg bg-[#1F1D2B]/85 px-3 py-1.5 text-[11px] font-medium text-[#FFF8EF]">
                  Drag to rotate 360° · Scroll to zoom
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAutoSpin((s) => !s)}
                    aria-label="Toggle auto-rotate"
                    className={`flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${
                      autoSpin
                        ? 'bg-[#FF7A00] text-white'
                        : 'bg-[#1F1D2B]/85 text-[#FFF8EF]'
                    }`}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    Spin
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomDist((d) => Math.max(1.4, d - 0.3))}
                    aria-label="Zoom in"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F1D2B]/85 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomDist((d) => Math.min(3.2, d + 0.3))}
                    aria-label="Zoom out"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F1D2B]/85 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoomDist(2.25);
                      setResetSignal((n) => n + 1);
                    }}
                    aria-label="Reset camera"
                    className="flex h-9 items-center gap-1 rounded-lg bg-[#1F1D2B]/85 px-2.5 text-xs font-semibold text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Product Specifications & Live Color Variant Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ProductBadge tone="surface">Demo Showroom Catalog · Phase 3</ProductBadge>
            <StockStatusLabel status={product.stockStatus} count={product.stockCount} />
          </div>

          <RatingDisplay rating={product.rating} reviewCount={product.reviewCount} />

          <PriceDisplay
            discountedPrice={product.discountedPrice}
            originalPrice={product.originalPrice}
            discountPercent={product.discountPercent}
            size="lg"
          />

          <p className="text-sm text-[#1F1D2B]/75 leading-relaxed">{product.description}</p>

          {/* Live 3D Colour Swatches */}
          <div className="space-y-2 pt-3 border-t border-[#1F1D2B]/10">
            <p className="text-xs font-semibold text-[#1F1D2B]">
              Colour Variant:{' '}
              <span className="font-normal text-[#1F1D2B]/70">{activeColor?.name}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {product.colors.map((c, idx) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColorIdx(idx)}
                  aria-label={`Change 3D garment color to ${c.name}`}
                  className={`h-9 w-9 rounded-full border cursor-pointer transition-transform ${
                    selectedColorIdx === idx
                      ? 'ring-2 ring-[#FF7A00] ring-offset-2 scale-105 border-white'
                      : 'border-[#1F1D2B]/25 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Available Sizes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#1F1D2B]">Available Sizes</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  className={`min-w-[44px] h-10 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    selectedSize === size
                      ? 'bg-[#1F1D2B] text-[#FFF8EF]'
                      : 'bg-white border border-[#1F1D2B]/15 text-[#1F1D2B] hover:border-[#FF7A00]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={product.stockStatus === 'out_of_stock'}
              leftIcon={<ShoppingBag className="h-4 w-4" />}
              onClick={() => addToCart(product, selectedSize, activeColor?.name || 'Default')}
            >
              Add to Cart
            </Button>
            <Button
              variant={isWishlisted ? 'secondary' : 'outline'}
              size="lg"
              fullWidth
              leftIcon={<Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current text-[#FF7A00]' : ''}`} />}
              onClick={() => toggleWishlist(product)}
            >
              {isWishlisted ? 'Saved' : 'Wishlist'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
