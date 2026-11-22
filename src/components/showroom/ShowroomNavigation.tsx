import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Footprints,
  Maximize,
  Minimize,
  RotateCcw,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SHOWROOM_SECTIONS, type ShowroomSectionId } from '../../data/showroomSections';
import type { RenderQuality } from '../../utils/webglDetect';

interface ShowroomNavigationProps {
  activeSection: ShowroomSectionId;
  guidedMode: boolean;
  soundEnabled: boolean;
  isFullscreen: boolean;
  quality: RenderQuality;
  isSoftwareGl: boolean;
  onSelectSection: (sectionId: ShowroomSectionId) => void;
  onToggleGuidedMode: () => void;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onChangeQuality: (quality: RenderQuality) => void;
}

export const ShowroomNavigation: React.FC<ShowroomNavigationProps> = ({
  activeSection,
  guidedMode,
  soundEnabled,
  isFullscreen,
  quality,
  isSoftwareGl,
  onSelectSection,
  onToggleGuidedMode,
  onToggleSound,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onChangeQuality,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="pointer-events-auto flex justify-center">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-11 items-center gap-2 rounded-xl border border-[#FFA94D]/35 bg-[#1F1D2B]/94 px-4 text-xs font-semibold text-[#FFF8EF] shadow-xl hover:border-[#FF7A00] cursor-pointer"
        >
          <ChevronUp className="h-4 w-4 text-[#FF7A00]" />
          <span>Show Showroom Navigation & Controls</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto mx-auto w-full max-w-5xl rounded-2xl border border-[#FFA94D]/30 bg-[#1F1D2B]/94 p-2.5 sm:p-3 text-[#FFF8EF] shadow-2xl">
      {/* Row 1: 8 Interactive Showroom Section Buttons */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SHOWROOM_SECTIONS.map((section) => {
            const active = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSection(section.id)}
                className={`shrink-0 h-9 rounded-xl px-3 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#FF7A00] text-white shadow-sm'
                    : 'bg-[#FFF8EF]/8 text-[#FFF8EF]/80 hover:bg-[#FFF8EF]/16 hover:text-white'
                }`}
              >
                {section.shortName}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse navigation dock"
          title="Collapse dock"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#FFF8EF]/15 bg-[#FFF8EF]/8 text-[#FFF8EF]/80 hover:bg-[#FFF8EF]/18 hover:text-white cursor-pointer"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Row 2: Camera Mode, Zoom, Quality, Sound, Fullscreen */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#FFF8EF]/12 pt-2">
        {/* Guided vs Free Walk Mode */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleGuidedMode}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors cursor-pointer ${
              guidedMode
                ? 'bg-[#FFA94D] text-[#1F1D2B]'
                : 'bg-[#FFF8EF]/10 text-[#FFF8EF] hover:bg-[#FFF8EF]/18'
            }`}
          >
            {guidedMode ? (
              <>
                <Compass className="h-3.5 w-3.5" />
                Guided Mode
              </>
            ) : (
              <>
                <Footprints className="h-3.5 w-3.5 text-[#FFA94D]" />
                Free Walk Mode
              </>
            )}
          </button>

          {/* Adaptive Quality Switcher */}
          <div className="hidden sm:flex items-center gap-1 rounded-xl bg-[#FFF8EF]/8 p-1 text-[11px]">
            <SlidersHorizontal className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-[#FFA94D]" />
            {(['low', 'medium', 'high'] as RenderQuality[]).map((level) => (
              <button
                key={level}
                type="button"
                disabled={isSoftwareGl && level !== 'low'}
                onClick={() => onChangeQuality(level)}
                title={
                  isSoftwareGl && level !== 'low'
                    ? 'Locked to Low for smooth software-WebGL rendering'
                    : `Set graphics quality to ${level}`
                }
                className={`rounded-lg px-2 py-1 font-semibold uppercase transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  quality === level
                    ? 'bg-[#FF7A00] text-white'
                    : 'text-[#FFF8EF]/70 hover:text-white'
                }`}
              >
                {level === 'medium' ? 'Med' : level}
              </button>
            ))}
          </div>
        </div>

        {/* Zoom, Audio & Fullscreen Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            title="Zoom In"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8EF]/10 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            title="Zoom Out"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8EF]/10 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            aria-label="Reset camera zoom"
            title="Reset Zoom"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8EF]/10 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <span className="mx-0.5 h-5 w-px bg-[#FFF8EF]/15" />

          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Mute showroom ambience' : 'Enable showroom ambience'}
            title={soundEnabled ? 'Sound On' : 'Sound Off'}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold cursor-pointer ${
              soundEnabled
                ? 'bg-[#16A34A] text-white'
                : 'bg-[#FFF8EF]/10 text-[#FFF8EF]/85 hover:bg-[#FFF8EF]/20'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span className="hidden md:inline">{soundEnabled ? 'Sound On' : 'Sound Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF8EF]/10 text-[#FFF8EF] hover:bg-[#FF7A00] cursor-pointer"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
