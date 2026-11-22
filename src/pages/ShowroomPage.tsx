import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Layers,
  LogOut,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { useStore } from '../context/StoreContext';
import { useCatalog } from '../context/CatalogContext';
import { getShowroomSectionById } from '../data/showroomSections';
import type { ShowroomProduct } from '../data/showroomProducts';
import { useShowroomNavigation } from '../hooks/useShowroomNavigation';
import { useShowroomControls } from '../hooks/useShowroomControls';
import {
  detectWebGLCapabilities,
  showroomAudio,
  type RenderQuality,
  type WebGLCapabilities,
} from '../utils/webglDetect';
import { ShowroomCanvas } from '../components/showroom/ShowroomCanvas';
import { ShowroomLoader } from '../components/showroom/ShowroomLoader';
import { ShowroomMiniMap } from '../components/showroom/ShowroomMiniMap';
import { ShowroomNavigation } from '../components/showroom/ShowroomNavigation';
import { ShowroomControls } from '../components/showroom/ShowroomControls';
import { ProductInfoPanel } from '../components/showroom/ProductInfoPanel';
import { ProductViewer } from '../components/showroom/ProductViewer';
import { ShowroomBlueprintView } from '../components/showroom/ShowroomBlueprintView';
import { Button, ProductBadge, ResilientImage } from '../components/ui/Primitives';

export const ShowroomPage: React.FC = () => {
  const { navigate } = useRouter();
  const { totalCartItems } = useStore();
  const { showroomRacks, showroomProductsById } = useCatalog();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const capabilities = useMemo<WebGLCapabilities>(() => detectWebGLCapabilities(), []);
  const [quality, setQuality] = useState<RenderQuality>(capabilities.recommendedQuality);
  const racks = showroomRacks;
  const fallbackProducts = useMemo(
    () => Object.values(showroomProductsById).slice(0, 5),
    [showroomProductsById]
  );

  const [sceneReady, setSceneReady] = useState(false);
  const [showLoader, setShowLoader] = useState(capabilities.supported);
  const [contextLost, setContextLost] = useState(false);
  const [forceFallback2D, setForceFallback2D] = useState(!capabilities.supported);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ShowroomProduct | null>(null);
  const [viewerProduct, setViewerProduct] = useState<ShowroomProduct | null>(null);

  const nav = useShowroomNavigation();
  const controls = useShowroomControls(containerRef);
  const currentSection = getShowroomSectionById(nav.activeSection);

  // Clean up procedural audio when leaving the showroom
  useEffect(() => {
    return () => {
      showroomAudio.setEnabled(false);
    };
  }, []);

  const handleEnterShowroom = useCallback(() => {
    setShowLoader(false);
    nav.enterShowroom();
  }, [nav]);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      showroomAudio.setEnabled(next);
      if (next) showroomAudio.playChime(587.33);
      return next;
    });
  }, []);

  const handleSelectProduct = useCallback((product: ShowroomProduct) => {
    setSelectedProduct(product);
    showroomAudio.playChime(783.99);
  }, []);

  const handleArriveClickTarget = useCallback(() => {
    nav.setClickTarget(null);
  }, [nav]);

  const handleRetryWebGL = useCallback(() => {
    setContextLost(false);
    setForceFallback2D(false);
    setSceneReady(false);
    setShowLoader(true);
  }, []);

  const isFallbackActive = forceFallback2D || contextLost || !capabilities.supported;

  if (isFallbackActive) {
    return (
      <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B]">
        {/* Top Fallback Header */}
        <header className="sticky top-0 z-30 border-b border-[#FFA94D]/25 bg-[#1F1D2B] px-4 py-3 text-[#FFF8EF]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => navigate('/')}
                className="text-[#FFF8EF] hover:bg-[#FFF8EF]/10"
              >
                Back to Home
              </Button>
              <div className="h-5 w-px bg-[#FFF8EF]/20 hidden sm:block" />
              <div>
                <h1 className="font-heading text-sm sm:text-base font-bold text-[#FFF8EF]">
                  3D Jummo Fashion World — Showroom Fallback Mode
                </h1>
                <p className="text-[11px] text-[#FFA94D]">
                  {!capabilities.supported
                    ? 'WebGL is unavailable on this browser — displaying 2D interactive showroom mode'
                    : contextLost
                      ? 'WebGL graphics context was interrupted — safe fallback active'
                      : '2D Showroom Blueprint Mode'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {capabilities.supported && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={handleRetryWebGL}
                >
                  Launch 3D Showroom
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                leftIcon={<LogOut className="h-3.5 w-3.5" />}
                onClick={() => navigate('/')}
                className="border-[#FFA94D]/40 text-[#FFF8EF] hover:bg-[#FFF8EF]/10 hover:text-white"
              >
                Exit Showroom
              </Button>
            </div>
          </div>
        </header>

        {/* WebGL Notice Banner */}
        {(!capabilities.supported || contextLost) && (
          <div className="mx-auto max-w-7xl px-4 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#F59E0B]/40 bg-[#FFE4C7]/60 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-[#F59E0B] shrink-0 mt-0.5" />
                <div>
                  <p className="font-heading text-sm font-bold text-[#1F1D2B]">
                    Interactive 3D WebGL Renderer Unavailable
                  </p>
                  <p className="text-xs text-[#1F1D2B]/75 mt-0.5">
                    Your current device or browser did not expose an active WebGL context. You can
                    still explore all showroom zones, inspect demo garments, and add items to your
                    cart or wishlist below.
                  </p>
                </div>
              </div>
              {capabilities.supported && (
                <Button variant="primary" size="sm" onClick={handleRetryWebGL}>
                  Retry 3D View
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Interactive Demo Collection Quick Strip */}
        <section className="mx-auto max-w-7xl px-4 pt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-bold text-[#1F1D2B]">
                Showroom Demo Collection (Quick Inspect)
              </h2>
              <p className="text-xs text-[#1F1D2B]/65">
                Tap any piece to open the Product Viewer with studio photo inspection & color
                variants.
              </p>
            </div>
            <ProductBadge tone="surface">Phase 3 Demo Data</ProductBadge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {fallbackProducts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setViewerProduct(item)}
                className="group rounded-2xl border border-[#1F1D2B]/10 bg-white p-2.5 text-left hover:border-[#FF7A00] transition-colors cursor-pointer"
              >
                <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-[#FFF8EF]">
                  <ResilientImage
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="mt-2 truncate font-heading text-xs font-semibold text-[#1F1D2B]">
                  {item.name}
                </p>
                <p className="text-xs font-bold text-[#FF7A00]">
                  ₹{item.discountedPrice.toLocaleString('en-IN')}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Preserved Phase 1 Architectural Showroom Blueprint */}
        <div className="mt-6">
          <ShowroomBlueprintView onBackToStorefront={() => navigate('/')} />
        </div>

        <ProductViewer
          product={viewerProduct}
          webglSupported={false}
          onClose={() => setViewerProduct(null)}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-[#1A1826] select-none"
    >
      {/* Interactive Three.js / React Three Fiber 3D Showroom */}
      <div className="absolute inset-0">
        <ShowroomCanvas
          racks={racks}
          productsById={showroomProductsById}
          activeSection={nav.activeSection}
          selectedProductId={selectedProduct?.id ?? null}
          doorsOpen={nav.doorsOpen}
          hasEntered={nav.hasEntered}
          guidedMode={nav.guidedMode}
          quality={quality}
          isSoftwareGl={capabilities.isSoftwareGl}
          zoomFov={controls.zoomFov}
          clickTarget={nav.clickTarget}
          cameraGoalRef={nav.cameraGoalRef}
          keysRef={controls.keysRef}
          joystickRef={controls.joystickRef}
          lookDeltaRef={controls.lookDeltaRef}
          onSelectProduct={handleSelectProduct}
          onFloorClick={nav.walkToPoint}
          onArriveClickTarget={handleArriveClickTarget}
          onTelemetry={nav.setPlayerPos}
          onContextLost={() => setContextLost(true)}
          onReady={() => setSceneReady(true)}
        />
      </div>

      {/* Premium 3D Loading & Entrance Overlay */}
      {showLoader && (
        <ShowroomLoader
          sceneReady={sceneReady}
          isSoftwareGl={capabilities.isSoftwareGl}
          quality={quality}
          onEnter={handleEnterShowroom}
          onBackHome={() => navigate('/')}
        />
      )}

      {/* Top HUD Bar (Solid/Translucent — Zero backdrop-blur over WebGL) */}
      {!showLoader && (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-20 p-3 sm:p-4">
          <div className="mx-auto flex max-w-[1600px] items-start justify-between gap-3">
            {/* Left: Back + Title */}
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 rounded-2xl border border-[#FFA94D]/30 bg-[#1F1D2B]/94 px-3 py-2 text-[#FFF8EF] shadow-xl">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FFF8EF]/10 px-2.5 text-xs font-semibold text-[#FFF8EF] hover:bg-[#FF7A00] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </button>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-[#FF7A00] shrink-0" />
                  <h1 className="truncate font-heading text-xs sm:text-sm font-bold text-[#FFF8EF]">
                    3D Jummo Fashion World
                  </h1>
                </div>
                <p className="truncate text-[11px] text-[#FFA94D]">
                  {currentSection.name} · Interactive Virtual Showroom
                </p>
              </div>
            </div>

            {/* Right: Quick Cart, 2D Blueprint Toggle & Exit */}
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[#FFA94D]/30 bg-[#1F1D2B]/94 p-1.5 text-[#FFF8EF] shadow-xl">
              <button
                type="button"
                onClick={() => setForceFallback2D(true)}
                title="Switch to 2D Showroom Blueprint View"
                className="hidden md:inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FFF8EF]/10 px-3 text-xs font-semibold text-[#FFF8EF]/90 hover:bg-[#FFF8EF]/20 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5 text-[#FFA94D]" />
                <span>2D View</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/cart')}
                aria-label="Open shopping cart"
                className="relative inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FFF8EF]/10 px-3 text-xs font-semibold text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">Cart</span>
                {totalCartItems > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold text-white">
                    {totalCartItems}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#DC2626]/90 px-3 text-xs font-semibold text-white hover:bg-[#DC2626] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Exit Showroom</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Transient Section Name Announcement Banner */}
      {!showLoader && nav.sectionBanner && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-20 -translate-x-1/2 px-4">
          <div className="rounded-xl border border-[#FFA94D]/45 bg-[#1F1D2B]/94 px-5 py-2 text-center shadow-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFA94D]">
              Now Exploring
            </p>
            <p className="font-heading text-sm sm:text-base font-bold text-[#FFF8EF]">
              {nav.sectionBanner}
            </p>
          </div>
        </div>
      )}

      {/* Right Rail: Interactive Mini-Map & On-Demand Product Info Panel */}
      {!showLoader && (
        <div className="pointer-events-none fixed right-3 sm:right-4 top-20 z-20 flex flex-col items-end gap-3 max-w-[calc(100vw-24px)]">
          <div className="pointer-events-auto">
            <ShowroomMiniMap
              activeSection={nav.activeSection}
              playerPos={nav.playerPos}
              onSelectSection={nav.navigateToSection}
            />
          </div>

          {selectedProduct && (
            <ProductInfoPanel
              product={selectedProduct}
              onClose={() => setSelectedProduct(null)}
              onOpen360Viewer={(prod) => setViewerProduct(prod)}
            />
          )}
        </div>
      )}

      {/* Bottom-Left: Controls Popover & Touch Virtual Joystick */}
      {!showLoader && (
        <div className="pointer-events-none fixed left-3 sm:left-4 bottom-28 sm:bottom-24 z-20">
          <ShowroomControls
            isMobile={capabilities.isMobile}
            guidedMode={nav.guidedMode}
            onJoystickChange={controls.setJoystick}
          />
        </div>
      )}

      {/* Bottom-Center: Collapsible Showroom Navigation & Camera Dock */}
      {!showLoader && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 sm:bottom-4 z-20 px-3 sm:px-4">
          <ShowroomNavigation
            activeSection={nav.activeSection}
            guidedMode={nav.guidedMode}
            soundEnabled={soundEnabled}
            isFullscreen={controls.isFullscreen}
            quality={quality}
            isSoftwareGl={capabilities.isSoftwareGl}
            onSelectSection={nav.navigateToSection}
            onToggleGuidedMode={() => nav.setGuidedMode((prev) => !prev)}
            onToggleSound={handleToggleSound}
            onToggleFullscreen={controls.toggleFullscreen}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onResetZoom={controls.resetZoom}
            onChangeQuality={setQuality}
          />
        </div>
      )}

      {/* Dedicated 360° Interactive 3D Product Viewer Modal */}
      <ProductViewer
        product={viewerProduct}
        webglSupported={capabilities.supported && !contextLost}
        onClose={() => setViewerProduct(null)}
      />
    </div>
  );
};
