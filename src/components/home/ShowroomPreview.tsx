import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Move3d,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { ASSETS, SHOWROOM_ZONES } from '../../data/catalog';
import { useRouter } from '../../router/RouterContext';
import { Button, ProductBadge, ResilientImage } from '../ui/Primitives';
import { useToast } from '../ui/Overlays';

export const ShowroomPreview: React.FC = () => {
  const { navigate } = useRouter();
  const { addToast } = useToast();
  const [zoneIdx, setZoneIdx] = useState(0);
  const [is360Active, setIs360Active] = useState(false);

  const activeZone = SHOWROOM_ZONES[zoneIdx];
  const panOffset = is360Active ? activeZone.cameraAngle * 0.3 : 0;

  const rotateZone = (dir: 'prev' | 'next') => {
    setIs360Active(true);
    setZoneIdx((prev) =>
      dir === 'next'
        ? (prev + 1) % SHOWROOM_ZONES.length
        : (prev - 1 + SHOWROOM_ZONES.length) % SHOWROOM_ZONES.length
    );
  };

  return (
    <section
      aria-labelledby="showroom-preview-heading"
      className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20"
    >
      <div className="overflow-hidden rounded-3xl border border-[#1F1D2B]/12 bg-[#1F1D2B] text-[#FFF8EF]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Left Architectural Showroom Visual Preview */}
          <div className="lg:col-span-7 relative min-h-[340px] sm:min-h-[440px] overflow-hidden bg-[#151320]">
            <div
              className="h-full w-full transition-transform duration-500 ease-out"
              style={{
                transform: `scale(${is360Active ? 1.12 : 1.04}) translateX(${-panOffset}%)`,
              }}
            >
              <ResilientImage
                src={ASSETS.showroomInterior}
                alt="3D Jummo Fashion World luxury interior with Men's and Women's clothing racks, circular golden lights, and fashion mannequins"
                className="h-full w-full object-cover"
              />
            </div>

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#1F1D2B]/85 via-transparent to-[#1F1D2B]/35"
            />

            {/* Callouts for Men's Rack, Mannequin Podium & Women's Rack */}
            <div className="hidden sm:block pointer-events-none absolute inset-0">
              <button
                type="button"
                onClick={() => {
                  setZoneIdx(1);
                  setIs360Active(true);
                }}
                className={`pointer-events-auto absolute left-[14%] top-[48%] rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  zoneIdx === 1
                    ? 'bg-[#FF7A00] text-white ring-4 ring-[#FF7A00]/30'
                    : 'bg-[#1F1D2B]/85 text-[#FFF8EF] border border-[#FFA94D]/50 hover:bg-[#1F1D2B]'
                }`}
              >
                Men&apos;s Racks
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoneIdx(0);
                  setIs360Active(true);
                }}
                className={`pointer-events-auto absolute left-[50%] top-[62%] -translate-x-1/2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  zoneIdx === 0
                    ? 'bg-[#FF7A00] text-white ring-4 ring-[#FF7A00]/30'
                    : 'bg-[#1F1D2B]/85 text-[#FFF8EF] border border-[#FFA94D]/50 hover:bg-[#1F1D2B]'
                }`}
              >
                Fashion Mannequins
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoneIdx(2);
                  setIs360Active(true);
                }}
                className={`pointer-events-auto absolute right-[10%] top-[48%] rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  zoneIdx === 2
                    ? 'bg-[#FF7A00] text-white ring-4 ring-[#FF7A00]/30'
                    : 'bg-[#1F1D2B]/85 text-[#FFF8EF] border border-[#FFA94D]/50 hover:bg-[#1F1D2B]'
                }`}
              >
                Women&apos;s Racks
              </button>
            </div>

            {/* Bottom Interactive 360° Preview Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#1F1D2B]/85 border border-white/15 px-3.5 py-1.5 text-xs font-medium backdrop-blur-xs">
                <Compass className="h-3.5 w-3.5 text-[#FFA94D]" />
                <span className="truncate">{activeZone.name}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => rotateZone('prev')}
                  aria-label="Pan showroom preview left"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1F1D2B]/85 border border-[#FFA94D]/45 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => rotateZone('next')}
                  aria-label="Pan showroom preview right"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1F1D2B]/85 border border-[#FFA94D]/45 text-[#FFF8EF] hover:bg-[#FF7A00] hover:border-[#FF7A00] transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Editorial Showroom Invitation Panel */}
          <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <ProductBadge tone="warning" icon={<Move3d className="h-3.5 w-3.5" />}>
                Live Interactive 3D WebGL Showroom
              </ProductBadge>

              <h2
                id="showroom-preview-heading"
                className="font-heading text-2xl sm:text-3xl font-bold leading-tight text-balance"
              >
                Walk Through the 3D Jummo Flagship Mall
              </h2>

              <p className="text-sm text-[#FFF8EF]/78 leading-relaxed">
                Step inside our architectural boutique featuring illuminated concentric golden ring
                lighting, Men&apos;s and Women&apos;s bespoke clothing racks, ceremonial traditional
                podiums, and curated fashion mannequins.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-white/6 border border-white/10 p-3.5">
                  <p className="text-xs text-[#FFA94D] font-semibold">Spatial Wings</p>
                  <p className="mt-1 font-heading text-lg font-bold tabular-nums">8 Sections</p>
                  <p className="text-[11px] text-[#FFF8EF]/60">Men, Women, Kids & Ethnic</p>
                </div>
                <div className="rounded-xl bg-white/6 border border-white/10 p-3.5">
                  <p className="text-xs text-[#FFA94D] font-semibold">Showroom Displays</p>
                  <p className="mt-1 font-heading text-lg font-bold tabular-nums">9 3D Racks</p>
                  <p className="text-[11px] text-[#FFF8EF]/60">4 Sculpted Mannequins</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={() => navigate('/showroom')}
              >
                Enter Showroom
              </Button>
              <button
                type="button"
                onClick={() => {
                  rotateZone('next');
                  addToast({
                    type: 'info',
                    title: `360° Preview: ${SHOWROOM_ZONES[(zoneIdx + 1) % SHOWROOM_ZONES.length].name}`,
                    description: 'Click Enter Showroom to walk inside the live Three.js boutique.',
                  });
                }}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#FFA94D]/45 bg-white/8 px-5 text-sm font-semibold text-[#FFF8EF] hover:bg-white/16 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCw className="h-4 w-4 text-[#FFA94D]" />
                360° View
              </button>
            </div>

            <p className="flex items-center gap-2 text-[11px] text-[#FFF8EF]/55">
              <Sparkles className="h-3.5 w-3.5 text-[#FFA94D] shrink-0" />
              <span>Powered by Three.js &amp; React Three Fiber · Real-time 360° Walkthrough</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
