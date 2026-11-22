import React, { useState } from 'react';
import { Compass, Map as MapIcon, Minimize2 } from 'lucide-react';
import { SHOWROOM_BOUNDS } from '../../data/showroomLayout';
import { SHOWROOM_SECTIONS, type ShowroomSectionId } from '../../data/showroomSections';
import type { PlayerTelemetry } from '../../hooks/useShowroomNavigation';

interface ShowroomMiniMapProps {
  activeSection: ShowroomSectionId;
  playerPos: PlayerTelemetry;
  onSelectSection: (sectionId: ShowroomSectionId) => void;
}

export const ShowroomMiniMap: React.FC<ShowroomMiniMapProps> = ({
  activeSection,
  playerPos,
  onSelectSection,
}) => {
  const [expanded, setExpanded] = useState(true);

  // Normalize world X/Z into 0..100 percentage coordinates inside the showroom map
  const mapPercentX = Math.max(
    5,
    Math.min(
      95,
      ((playerPos.x - SHOWROOM_BOUNDS.minX) / (SHOWROOM_BOUNDS.maxX - SHOWROOM_BOUNDS.minX)) * 100
    )
  );
  const mapPercentY = Math.max(
    5,
    Math.min(
      96,
      ((playerPos.z - SHOWROOM_BOUNDS.minZ) / (SHOWROOM_BOUNDS.maxZ - SHOWROOM_BOUNDS.minZ)) * 100
    )
  );

  // Convert camera yaw (radians; 0 faces -Z / North) to CSS clockwise degrees
  const headingDeg = (-playerPos.yaw * 180) / Math.PI;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Open showroom mini-map"
        className="flex h-11 items-center gap-2 rounded-xl border border-[#FFA94D]/30 bg-[#1F1D2B]/92 px-3.5 text-xs font-semibold text-[#FFF8EF] shadow-lg hover:border-[#FF7A00] cursor-pointer"
      >
        <MapIcon className="h-4 w-4 text-[#FF7A00]" />
        <span>Mini-Map</span>
      </button>
    );
  }

  return (
    <div
      className="w-52 sm:w-60 rounded-2xl border border-[#FFA94D]/30 bg-[#1F1D2B]/94 p-3 text-[#FFF8EF] shadow-xl"
      aria-label="Interactive Showroom Mini-Map"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-[#FFA94D]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FFE4C7]">
            Showroom Map
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Minimize mini-map"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#FFF8EF]/70 hover:bg-[#FFF8EF]/10 hover:text-white cursor-pointer"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Floor Plan Canvas */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[#FFF8EF]/15 bg-[#14121E]">
        {/* Architectural grid lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, #FFA94D 1px, transparent 1px), linear-gradient(to bottom, #FFA94D 1px, transparent 1px)',
            backgroundSize: '25% 25%',
          }}
        />

        {/* Central Circular Mannequin Podium */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#FFA94D]/60 bg-[#FF7A00]/15" />

        {/* Entrance Glass Doors Indicator (South) */}
        <div className="pointer-events-none absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-[#1F1D2B] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#FFA94D] border border-[#FFA94D]/30">
          Entrance
        </div>

        {/* Clickable Section Nodes */}
        {SHOWROOM_SECTIONS.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelectSection(section.id)}
              title={`Jump to ${section.name}`}
              style={{ left: `${section.mapX}%`, top: `${section.mapY}%` }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF7A00]`}
            >
              <span
                className={`block rounded-full border transition-transform group-hover:scale-125 ${
                  isActive
                    ? 'h-3.5 w-3.5 border-white bg-[#FF7A00] shadow-[0_0_10px_#FF7A00]'
                    : 'h-2.5 w-2.5 border-[#1F1D2B] bg-[#FFE4C7]/85'
                }`}
              />
              <span
                className={`mt-0.5 whitespace-nowrap rounded px-1 text-[8px] font-semibold leading-tight ${
                  isActive
                    ? 'bg-[#FF7A00] text-white'
                    : 'bg-[#1F1D2B]/90 text-[#FFF8EF]/80 group-hover:text-white'
                }`}
              >
                {section.shortName}
              </span>
            </button>
          );
        })}

        {/* Live Customer Position + Directional Cone */}
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
          style={{
            left: `${mapPercentX}%`,
            top: `${mapPercentY}%`,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{ transform: `rotate(${headingDeg}deg)` }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 1L16 15L10 12L4 15L10 1Z" fill="#2563EB" stroke="#FFF8EF" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-[#FFF8EF]/65 text-center">
        Tap any section marker to teleport camera
      </p>
    </div>
  );
};
