import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Primitives';
import type { RenderQuality } from '../../utils/webglDetect';

interface ShowroomLoaderProps {
  sceneReady: boolean;
  isSoftwareGl: boolean;
  quality: RenderQuality;
  onEnter: () => void;
  onBackHome: () => void;
}

const LOADING_STEPS = [
  { at: 15, text: 'Detecting WebGL & GPU rendering profile...' },
  { at: 42, text: 'Constructing luxury marble showroom & ceiling chandeliers...' },
  { at: 72, text: 'Placing Phase 3 demo collections across 9 interactive racks...' },
  { at: 92, text: 'Calibrating 360° mannequins, sliding glass doors & shadows...' },
  { at: 100, text: '3D Virtual Showroom Ready — Doors Unlocked' },
];

export const ShowroomLoader: React.FC<ShowroomLoaderProps> = ({
  sceneReady,
  isSoftwareGl,
  quality,
  onEnter,
  onBackHome,
}) => {
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        if (sceneReady) {
          return prev >= 100 ? 100 : Math.min(100, prev + 14);
        }
        return prev < 86 ? prev + 6 : prev;
      });
    }, 90);

    return () => window.clearInterval(timer);
  }, [sceneReady]);

  const isReady = progress >= 100 && sceneReady;
  const activeStep =
    [...LOADING_STEPS].reverse().find((step) => progress >= step.at) || LOADING_STEPS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1F1D2B] px-6 text-[#FFF8EF]"
      role="dialog"
      aria-modal="true"
      aria-label="Loading 3D Virtual Clothing Showroom"
    >
      {/* Subtle Architectural Frame */}
      <div className="pointer-events-none absolute inset-4 sm:inset-8 rounded-3xl border border-[#FFA94D]/20" />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(255, 122, 0, 0.24), transparent 58%)',
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-[#FFA94D]/25 bg-[#191724] p-7 sm:p-10 shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <BrandLogo variant="dark" />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#FFA94D]">
          3D Jummo Fashion World · Flagship Mall
        </p>
        <h1 className="mt-2 font-heading text-2xl sm:text-3xl font-bold tracking-tight text-[#FFF8EF]">
          Interactive 3D Virtual Showroom
        </h1>
        <p className="mt-2.5 text-sm text-[#FFF8EF]/70 leading-relaxed">
          Walk through our luxury flagship interior, explore curated clothing racks, inspect
          mannequins, and rotate garments in 360°.
        </p>

        {/* Progress Bar */}
        <div className="mt-7 space-y-2.5 text-left">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#FFF8EF]/80 flex items-center gap-1.5">
              {isReady ? (
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
              ) : (
                <Sparkles className="h-4 w-4 text-[#FFA94D]" />
              )}
              {activeStep.text}
            </span>
            <span className="font-mono text-[#FFA94D] tabular-nums">{progress}%</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FFF8EF]/10 border border-[#FFF8EF]/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FFA94D] transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#FFF8EF]/55">
            <span>
              Render Profile:{' '}
              <strong className="text-[#FFE4C7] uppercase">
                {isSoftwareGl ? 'Adaptive Lite' : quality}
              </strong>
            </span>
            <span>Phase 3 Local Demo Catalog Active</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!isReady}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={onEnter}
          >
            {isReady ? 'Enter Showroom' : 'Preparing Showroom...'}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onBackHome}
            className="text-[#FFF8EF]/75 hover:text-[#FFF8EF] hover:bg-[#FFF8EF]/10 shrink-0"
          >
            Back to Home
          </Button>
        </div>

        {/* Quick Controls Hint */}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[#FFF8EF]/10 pt-5 text-[11px] text-[#FFF8EF]/65">
          <div>
            <p className="font-semibold text-[#FFE4C7]">Move</p>
            <p>WASD / Joystick</p>
          </div>
          <div>
            <p className="font-semibold text-[#FFE4C7]">Look 360°</p>
            <p>Drag / Swipe</p>
          </div>
          <div>
            <p className="font-semibold text-[#FFE4C7]">Inspect</p>
            <p>Click Any Outfit</p>
          </div>
        </div>
      </div>
    </div>
  );
};
