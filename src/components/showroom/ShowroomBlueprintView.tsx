import React, { useState } from 'react';
import {
  ArrowLeft,
  Box,
  Compass,
  Eye,
  LampCeiling,
  Layers,
  Move3d,
  RotateCw,
  Sparkles,
  Store,
} from 'lucide-react';
import { ASSETS, PRODUCTS, SHOWROOM_ZONES } from '../../data/catalog';
import { Button, ProductBadge, ResilientImage, StatusAlert } from '../ui/Primitives';

interface ShowroomBlueprintViewProps {
  onBackToStorefront: () => void;
}

export const ShowroomBlueprintView: React.FC<ShowroomBlueprintViewProps> = ({
  onBackToStorefront,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState(SHOWROOM_ZONES[0].id);
  const selectedZone = SHOWROOM_ZONES.find((z) => z.id === selectedZoneId) || SHOWROOM_ZONES[0];

  const zoneProducts = PRODUCTS.filter((p) => selectedZone.featuredSkus.includes(p.sku));

  const architecturalMaterials = [
    {
      title: 'Concentric Ceiling Rings',
      detail: 'Suspended matte obsidian & warm 3000K LED halo rings creating dramatic mall presence.',
      swatch: '#FFA94D',
    },
    {
      title: 'Polished Marble Flooring',
      detail: 'Reflective Crema Marfil marble slabs with hairline brushed brass inlay corridors.',
      swatch: '#FFE4C7',
    },
    {
      title: 'Fluted Obsidian Walls',
      detail: 'Matte #1F1D2B architectural paneling paired with backlit vertical brass display slats.',
      swatch: '#1F1D2B',
    },
    {
      title: 'Illuminated Mannequin Plinths',
      detail: 'Circular brushed-gold podiums with soft perimeter underglow for hero seasonal silhouettes.',
      swatch: '#FF7A00',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF8EF] text-[#1F1D2B] pb-16">
      {/* Header Banner */}
      <div className="bg-[#1F1D2B] text-[#FFF8EF] border-b border-white/10">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#FFA94D] hover:text-white transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customer Storefront
          </button>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-medium text-[#FFA94D]">
                Phase 1 Visual Direction · Three.js Architecture Blueprint
              </p>
              <h1 className="mt-1 font-heading text-2xl sm:text-4xl font-bold tracking-tight text-balance">
                3D Jummo Fashion World — Showroom Visual Foundation
              </h1>
              <p className="mt-2 text-sm text-[#FFF8EF]/75 leading-relaxed">
                Spatial architecture, display racks, ceiling ring lighting, mannequin podiums, and
                360-degree navigation control specifications prepared for Phase 3 WebGL implementation.
              </p>
            </div>
            <ProductBadge tone="warning" icon={<Move3d className="h-3.5 w-3.5" />}>
              Visual Placeholder · Phase 3 Three.js
            </ProductBadge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        <StatusAlert
          variant="info"
          title="Phase 1 Strict Boundary Notice"
          description="This view defines the architectural aesthetics, spatial zoning, lighting presets, and 360° HUD controls. Real-time Three.js / WebGL rendering is intentionally scheduled for Phase 3."
        />

        {/* Interactive Floorplan + Zone Inspector */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Interactive Spatial Map */}
          <div className="lg:col-span-7 rounded-2xl border border-[#1F1D2B]/12 bg-[#1F1D2B] p-5 sm:p-6 text-[#FFF8EF] flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-heading text-lg font-semibold">Interactive Showroom Floorplan</h2>
                <p className="text-xs text-[#FFF8EF]/65">
                  Select any spatial wing to inspect lighting, racks, and featured mannequins
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFA94D] tabular-nums">
                <Compass className="h-4 w-4" />5 Zones
              </span>
            </div>

            {/* Clean Architectural SVG Spatial Layout */}
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-[#171522] p-4">
              {/* Subtle Floor Grid */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(255,169,77,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,169,77,0.35) 1px, transparent 1px)',
                  backgroundSize: '36px 36px',
                }}
              />

              {/* Central Concentric Chandelier Ring Indicator */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFA94D]/45"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FF7A00]/65 bg-[#FF7A00]/10"
              />

              {/* Interactive Zone Buttons positioned spatially */}
              {SHOWROOM_ZONES.map((zone) => {
                const active = zone.id === selectedZone.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedZoneId(zone.id)}
                    style={{ left: `${zone.hotspotX}%`, top: `${zone.hotspotY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-left transition-all duration-200 cursor-pointer ${
                      active
                        ? 'bg-[#FF7A00] text-white shadow-lg ring-4 ring-[#FF7A00]/30 scale-105 z-10'
                        : 'bg-[#1F1D2B]/95 border border-[#FFA94D]/40 text-[#FFF8EF] hover:border-[#FF7A00]'
                    }`}
                  >
                    <p className="text-xs font-semibold whitespace-nowrap">{zone.category}</p>
                    <p
                      className={`text-[10px] tabular-nums ${
                        active ? 'text-white/90' : 'text-[#FFA94D]'
                      }`}
                    >
                      {zone.rackCount} Racks · {zone.mannequinCount} Mannequins
                    </p>
                  </button>
                );
              })}

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-[#FFF8EF]/65">
                <span>South Grand Entrance</span>
                <span className="tabular-nums">Ceiling Height: 6.4m · Crema Marfil Marble</span>
              </div>
            </div>

            {/* 360° Control HUD Specification */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/6 border border-white/10 px-4 py-3 text-xs">
              <span className="inline-flex items-center gap-2 font-semibold text-[#FFA94D]">
                <RotateCw className="h-4 w-4" />
                360° Navigation Control Spec
              </span>
              <span className="text-[#FFF8EF]/75">
                Orbit Drag · Hotspot Teleport · Rack Focus Zoom · Lighting Presets
              </span>
            </div>
          </div>

          {/* Right Zone Specification Inspector */}
          <div className="lg:col-span-5 rounded-2xl border border-[#1F1D2B]/12 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#FF7A00]">{selectedZone.category}</p>
                  <h2 className="font-heading text-xl font-semibold text-[#1F1D2B]">
                    {selectedZone.name}
                  </h2>
                </div>
                <span className="rounded-lg bg-[#FFE4C7] px-2.5 py-1 text-xs font-semibold text-[#1F1D2B] tabular-nums">
                  {selectedZone.cameraAngle >= 0
                    ? `+${selectedZone.cameraAngle}°`
                    : `${selectedZone.cameraAngle}°`}
                </span>
              </div>

              <p className="text-sm text-[#1F1D2B]/70 leading-relaxed">{selectedZone.description}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#FFF8EF] border border-[#1F1D2B]/8 p-3.5">
                  <p className="text-xs text-[#1F1D2B]/55">Display Racks</p>
                  <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
                    {selectedZone.rackCount} Units
                  </p>
                </div>
                <div className="rounded-xl bg-[#FFF8EF] border border-[#1F1D2B]/8 p-3.5">
                  <p className="text-xs text-[#1F1D2B]/55">Styled Mannequins</p>
                  <p className="mt-1 font-heading text-xl font-bold text-[#1F1D2B] tabular-nums">
                    {selectedZone.mannequinCount} Figures
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#1F1D2B]/10 text-xs">
                <div className="flex items-start gap-2.5">
                  <LampCeiling className="h-4 w-4 text-[#FF7A00] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#1F1D2B]">Ceiling Lighting</p>
                    <p className="text-[#1F1D2B]/65">{selectedZone.lightingPreset}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Layers className="h-4 w-4 text-[#FF7A00] mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#1F1D2B]">Floor Finish</p>
                    <p className="text-[#1F1D2B]/65">{selectedZone.floorFinish}</p>
                  </div>
                </div>
              </div>

              {/* Featured Garments Assigned to this Wing */}
              <div className="pt-2 border-t border-[#1F1D2B]/10">
                <p className="text-xs font-semibold text-[#1F1D2B] mb-2.5">
                  Assigned Rack Garments
                </p>
                <div className="space-y-2">
                  {zoneProducts.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl bg-[#FFF8EF] p-2.5 border border-[#1F1D2B]/8"
                    >
                      <ResilientImage
                        src={item.image}
                        alt={item.name}
                        className="h-12 w-10 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#1F1D2B] truncate">{item.name}</p>
                        <p className="text-[11px] text-[#1F1D2B]/55 tabular-nums">
                          {item.sku} · ₹{item.discountedPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              leftIcon={<Store className="h-4 w-4" />}
              onClick={onBackToStorefront}
            >
              Return to Live Storefront Preview
            </Button>
          </div>
        </section>

        {/* Architectural Materials & Lighting Palette */}
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#FF7A00]">Interior Architecture</p>
            <h2 className="font-heading text-2xl font-semibold text-[#1F1D2B]">
              Showroom Materials, Racks & Lighting System
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {architecturalMaterials.map((mat) => (
              <div
                key={mat.title}
                className="rounded-2xl border border-[#1F1D2B]/10 bg-white p-5 space-y-3"
              >
                <div
                  className="h-12 w-12 rounded-xl border border-[#1F1D2B]/12"
                  style={{ backgroundColor: mat.swatch }}
                />
                <h3 className="font-heading text-base font-semibold text-[#1F1D2B]">{mat.title}</h3>
                <p className="text-xs text-[#1F1D2B]/65 leading-relaxed">{mat.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Visual Direction Comparison: Architectural Render & Reference Concept Board */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
            <div className="aspect-video w-full overflow-hidden bg-[#1F1D2B]">
              <ResilientImage
                src={ASSETS.showroomInterior}
                alt="Fashion World architectural 3D showroom render"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-base font-semibold text-[#1F1D2B]">
                  Showroom Interior Lighting Render
                </h3>
                <p className="mt-1 text-xs text-[#1F1D2B]/65">
                  Primary visual target for Phase 3 Three.js environment lighting, PBR marble
                  reflections, and concentric ring chandeliers.
                </p>
              </div>
              <Sparkles className="h-5 w-5 text-[#FF7A00] shrink-0" />
            </div>
          </div>

          <div className="rounded-2xl border border-[#1F1D2B]/10 bg-white overflow-hidden">
            <div className="aspect-video w-full overflow-hidden bg-[#1F1D2B]">
              <ResilientImage
                src={ASSETS.referenceMockup}
                alt="Fashion World master visual concept board reference"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-base font-semibold text-[#1F1D2B]">
                  Master Concept Board Reference
                </h3>
                <p className="mt-1 text-xs text-[#1F1D2B]/65">
                  Original unified visual direction aligning desktop storefront, mobile shopping
                  view, product detail module, and admin dashboard.
                </p>
              </div>
              <Box className="h-5 w-5 text-[#FF7A00] shrink-0" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
