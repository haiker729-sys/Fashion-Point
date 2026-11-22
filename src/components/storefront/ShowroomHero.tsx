import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Glasses,
  Grid,
  Headphones,
  Heart,
  Maximize2,
  RotateCw,
  Sparkles,
  Sun,
  Tag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ASSETS, SHOWROOM_ZONES, type ShowroomZone } from '../../data/catalog';
import { Button, ResilientImage } from '../ui/Primitives';
import { useToast } from '../ui/Overlays';

export interface ShowroomHeroProps {
  onSelectCategoryFilter: (cat: string) => void;
  onOpenFullBlueprint: () => void;
  onOpenWishlist: () => void;
}

type LightingMode = 'warm-gold' | 'runway-day' | 'evening-luxe';

const LIGHTING_STYLES: Record<LightingMode, { label: string; filterClass: string }> = {
  'warm-gold': { label: 'Warm Gold', filterClass: 'brightness-100 saturate-105' },
  'runway-day': { label: 'Gallery Day', filterClass: 'brightness-108 contrast-95 saturate-95' },
  'evening-luxe': { label: 'Evening Luxe', filterClass: 'brightness-85 contrast-110 saturate-115' },
};

export const ShowroomHero: React.FC<ShowroomHeroProps> = ({
  onSelectCategoryFilter,
  onOpenFullBlueprint,
  onOpenWishlist,
}) => {
  const { addToast } = useToast();
  const [activeZoneIndex, setActiveZoneIndex] = useState(0);
  const [panOffset, setPanOffset] = useState(0); // -14 to +14 simulated 360 horizontal pan %
  const [lighting, setLighting] = useState<LightingMode>('warm-gold');
  const [ambientAudio, setAmbientAudio] = useState(false);

  const activeZone: ShowroomZone = SHOWROOM_ZONES[activeZoneIndex];

  const handleOrbit = (direction: 'left' | 'right') => {
    const nextIndex =
      direction === 'right'
        ? (activeZoneIndex + 1) % SHOWROOM_ZONES.length
        : (activeZoneIndex - 1 + SHOWROOM_ZONES.length) % SHOWROOM_ZONES.length;
    setActiveZoneIndex(nextIndex);
    setPanOffset(SHOWROOM_ZONES[nextIndex].cameraAngle * 0.25);
  };

  const selectZone = (index: number) => {
    setActiveZoneIndex(index);
    setPanOffset(SHOWROOM_ZONES[index].cameraAngle * 0.25);
  };

  const cycleLighting = () => {
    const order: LightingMode[] = ['warm-gold', 'runway-day', 'evening-luxe'];
    const next = order[(order.indexOf(lighting) + 1) % order.length];
    setLighting(next);
    addToast({
      type: 'info',
      title: `Showroom Lighting: ${LIGHTING_STYLES[next].label}`,
      description: 'Phase 1 visual ambiance preview updated.',
    });
  };

  const quickRailItems = [
    {
      label: '3D Store',
      icon: Compass,
      active: true,
      action: onOpenFullBlueprint,
    },
    {
      label: 'Categories',
      icon: Grid,
      active: false,
      action: () =>
        document.getElementById('fw-categories-section')?.scrollIntoView({ behavior: 'smooth' }),
    },
    {
      label: 'Offers',
      icon: Tag,
      active: false,
      action: () => {
        onSelectCategoryFilter('Offers');
        document.getElementById('fw-catalog-section')?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      label: 'New',
      icon: Sparkles,
      active: false,
      action: () => {
        onSelectCategoryFilter('New Arrivals');
        document.getElementById('fw-catalog-section')?.scrollIntoView({ behavior: 'smooth' });
      },
    },
    {
      label: 'Wishlist',
      icon: Heart,
      active: false,
      action: onOpenWishlist,
    },
    {
      label: 'Support',
      icon: Headphones,
      active: false,
      action: () =>
        document.getElementById('fw-footer-section')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];

  return (
    <section
      id="fw-showroom-section"
      aria-label="3D Luxury Showroom Visual Direction"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7"
    >
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* Desktop Luxury Quick-Access Rail (inspired by Fashion World reference) */}
        <aside
          aria-label="Quick store navigation"
          className="hidden lg:flex w-[86px] shrink-0 flex-col justify-between rounded-2xl bg-[#1F1D2B] p-2.5 text-[#FFF8EF]"
        >
          <div className="flex flex-col gap-1.5">
            {quickRailItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 px-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    item.active
                      ? 'bg-[#FF7A00] text-white font-semibold'
                      : 'text-[#FFF8EF]/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/10 text-center">
            <span className="text-[10px] font-semibold text-[#FFA94D] tabular-nums">360°</span>
          </div>
        </aside>

        {/* Main Luxury 3D Showroom Visual Stage */}
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-[#1F1D2B]/12 bg-[#1F1D2B] min-h-[380px] sm:min-h-[470px] lg:min-h-[520px] flex flex-col justify-between">
          {/* Interactive Panorama Showroom Visual */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="h-full w-full transition-transform duration-500 ease-out"
              style={{
                transform: `scale(1.12) translateX(${-panOffset}%)`,
              }}
            >
              <ResilientImage
                src={ASSETS.showroomInterior}
                alt="Fashion World luxury 3D showroom interior with circular golden ceiling lights, marble flooring, and couture mannequins"
                className={`h-full w-full object-cover transition-all duration-300 ${LIGHTING_STYLES[lighting].filterClass}`}
              />
            </div>

            {/* Measured Contrast Scrim for Guaranteed WCAG AA Legibility */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#1F1D2B]/90 via-[#1F1D2B]/25 to-[#1F1D2B]/55"
            />
          </div>

          {/* Interactive Spatial Hotspots inside the Showroom */}
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            {SHOWROOM_ZONES.map((zone, idx) => {
              const isSelected = idx === activeZoneIndex;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(idx)}
                  style={{ left: `${zone.hotspotX}%`, top: `${zone.hotspotY}%` }}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer shadow-lg ${
                    isSelected
                      ? 'bg-[#FF7A00] text-white scale-105 ring-4 ring-[#FF7A00]/30'
                      : 'bg-[#1F1D2B]/80 text-[#FFF8EF] border border-[#FFA94D]/50 hover:bg-[#1F1D2B]'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  <span className="whitespace-nowrap">{zone.category}</span>
                </button>
              );
            })}
          </div>

          {/* Top Bar inside Showroom Stage: Editorial Title + Right Utility Controls */}
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4 p-4 sm:p-6">
            <div className="max-w-lg">
              <p className="text-xs font-medium text-[#FFA94D]">
                3D Showroom Visual Direction · Phase 3 Three.js Ready
              </p>
              <h1 className="mt-1 font-heading text-2xl sm:text-3xl lg:text-4xl font-bold text-[#FFF8EF] tracking-tight text-balance">
                {activeZone.name}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-[#FFF8EF]/80 leading-relaxed max-w-md">
                {activeZone.description}
              </p>
            </div>

            {/* Right Floating 360° Control Stack (Matching Luxury Reference) */}
            <div className="flex sm:flex-col items-center gap-2">
              <button
                type="button"
                onClick={cycleLighting}
                aria-label="Switch showroom lighting preset"
                title={`Lighting: ${LIGHTING_STYLES[lighting].label}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/80 border border-white/20 text-[#FFA94D] hover:bg-[#FF7A00] hover:text-white hover:border-[#FF7A00] transition-colors cursor-pointer backdrop-blur-xs"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenFullBlueprint}
                aria-label="Inspect full 3D showroom blueprint"
                title="Open 3D Showroom Blueprint"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/80 border border-white/20 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer backdrop-blur-xs"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmbientAudio((a) => !a);
                  addToast({
                    type: 'info',
                    title: ambientAudio ? 'Showroom Ambience Muted' : 'Showroom Ambience Preview On',
                    description: 'Audio controller UI placeholder for Phase 3.',
                  });
                }}
                aria-label={ambientAudio ? 'Mute ambient audio' : 'Enable ambient audio'}
                title="Ambient Audio Control"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/80 border border-white/20 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer backdrop-blur-xs"
              >
                {ambientAudio ? <Volume2 className="h-4 w-4 text-[#FFA94D]" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() =>
                  addToast({
                    type: 'info',
                    title: 'WebXR / VR Showroom Scheduled for Phase 3',
                    description: 'Phase 1 establishes the interactive HUD & lighting visual system.',
                  })
                }
                aria-label="VR Showroom Preview"
                title="VR Mode Preview (Phase 3)"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/80 border border-white/20 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer backdrop-blur-xs"
              >
                <Glasses className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom Bar: 360° Orbit Controls, Zone Switcher & Primary CTA */}
          <div className="relative z-10 flex flex-col gap-3 p-4 sm:p-6 pt-0">
            {/* Zone Selector Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto fw-no-scrollbar pb-1">
              {SHOWROOM_ZONES.map((zone, idx) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => selectZone(idx)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    idx === activeZoneIndex
                      ? 'bg-[#FFE4C7] text-[#1F1D2B] font-semibold'
                      : 'bg-[#1F1D2B]/70 text-[#FFF8EF]/80 border border-white/15 hover:bg-[#1F1D2B]'
                  }`}
                >
                  {zone.category}
                </button>
              ))}
            </div>

            {/* Bottom Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/15">
              {/* 360 Degree Navigation Control */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOrbit('left')}
                  aria-label="Rotate showroom view left"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/85 border border-[#FFA94D]/50 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#1F1D2B]/85 border border-white/15 px-4 py-2 text-xs font-semibold text-[#FFF8EF] tabular-nums">
                  <RotateCw className="h-3.5 w-3.5 text-[#FFA94D]" />
                  <span>360° View</span>
                  <span className="text-[#FFF8EF]/40">·</span>
                  <span className="text-[#FFA94D]">
                    {activeZone.cameraAngle >= 0 ? `+${activeZone.cameraAngle}°` : `${activeZone.cameraAngle}°`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOrbit('right')}
                  aria-label="Rotate showroom view right"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1D2B]/85 border border-[#FFA94D]/50 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (
                      activeZone.category === 'Men' ||
                      activeZone.category === 'Women' ||
                      activeZone.category === 'Kids' ||
                      activeZone.category === 'Traditional Wear'
                    ) {
                      onSelectCategoryFilter(activeZone.category);
                    }
                    document
                      .getElementById('fw-catalog-section')
                      ?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Shop {activeZone.category === 'Showroom Entrance' ? 'Collection' : activeZone.category}
                </Button>
                <button
                  type="button"
                  onClick={onOpenFullBlueprint}
                  className="hidden sm:inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-[#FFF8EF] hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Inspect 3D Blueprint
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
