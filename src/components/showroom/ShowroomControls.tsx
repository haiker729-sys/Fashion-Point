import React, { useRef, useState } from 'react';
import { Gamepad2, HelpCircle, X } from 'lucide-react';
import type { JoystickVector } from '../../hooks/useShowroomControls';

interface ShowroomControlsProps {
  isMobile: boolean;
  guidedMode: boolean;
  onJoystickChange: (vec: JoystickVector) => void;
}

export const ShowroomControls: React.FC<ShowroomControlsProps> = ({
  isMobile,
  guidedMode,
  onJoystickChange,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showJoystick, setShowJoystick] = useState(isMobile);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const padRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const maxRadius = 36;

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    const ox = Math.cos(angle) * clampedDist;
    const oy = Math.sin(angle) * clampedDist;
    setKnobOffset({ x: ox, y: oy });
    onJoystickChange({ x: ox / maxRadius, y: oy / maxRadius });
  };

  const resetStick = () => {
    activePointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickChange({ x: 0, y: 0 });
  };

  return (
    <div className="pointer-events-none flex flex-col items-start gap-2.5">
      {/* Movement Instructions Popover */}
      {showHelp && (
        <div className="pointer-events-auto w-64 rounded-2xl border border-[#FFA94D]/35 bg-[#1F1D2B]/95 p-4 text-xs text-[#FFF8EF] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#FFF8EF]/12 pb-2 mb-2.5">
            <span className="font-heading font-semibold text-[#FFE4C7]">Showroom Controls</span>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              aria-label="Close controls help"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#FFF8EF]/70 hover:bg-[#FFF8EF]/10 hover:text-white cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-2 text-[#FFF8EF]/80">
            <li className="flex items-start justify-between gap-2">
              <span className="font-semibold text-[#FFA94D]">Walk</span>
              <span className="text-right">WASD / Arrow Keys / Joystick</span>
            </li>
            <li className="flex items-start justify-between gap-2">
              <span className="font-semibold text-[#FFA94D]">360° Look</span>
              <span className="text-right">Click & Drag or Touch Swipe</span>
            </li>
            <li className="flex items-start justify-between gap-2">
              <span className="font-semibold text-[#FFA94D]">Floor Walk</span>
              <span className="text-right">Click marble floor to glide</span>
            </li>
            <li className="flex items-start justify-between gap-2">
              <span className="font-semibold text-[#FFA94D]">Inspect</span>
              <span className="text-right">Tap any garment or mannequin</span>
            </li>
          </ul>
        </div>
      )}

      {/* Virtual Joystick Pad (Mobile default, toggleable on Desktop) */}
      {showJoystick && !guidedMode && (
        <div
          ref={padRef}
          role="slider"
          aria-label="Virtual movement joystick"
          aria-valuenow={Math.round(Math.hypot(knobOffset.x, knobOffset.y))}
          tabIndex={0}
          onPointerDown={(e) => {
            e.stopPropagation();
            activePointerIdRef.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (activePointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            updateStick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (activePointerIdRef.current !== e.pointerId) return;
            e.stopPropagation();
            resetStick();
          }}
          onPointerCancel={resetStick}
          className="pointer-events-auto relative flex h-28 w-28 touch-none select-none items-center justify-center rounded-full border-2 border-[#FFA94D]/45 bg-[#1F1D2B]/85 shadow-xl"
        >
          <span className="pointer-events-none absolute top-1.5 text-[9px] font-bold text-[#FFA94D]/80">
            W
          </span>
          <span className="pointer-events-none absolute bottom-1.5 text-[9px] font-bold text-[#FFA94D]/80">
            S
          </span>
          <span className="pointer-events-none absolute left-2 text-[9px] font-bold text-[#FFA94D]/80">
            A
          </span>
          <span className="pointer-events-none absolute right-2 text-[9px] font-bold text-[#FFA94D]/80">
            D
          </span>
          <div
            className="h-11 w-11 rounded-full border-2 border-[#FFF8EF] bg-[#FF7A00] shadow-md transition-transform duration-75"
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
      )}

      {/* Compact Action Triggers */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-lg cursor-pointer ${
            showHelp
              ? 'border-[#FF7A00] bg-[#FF7A00] text-white'
              : 'border-[#FFA94D]/30 bg-[#1F1D2B]/92 text-[#FFF8EF] hover:border-[#FF7A00]'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Controls</span>
        </button>

        {!guidedMode && (
          <button
            type="button"
            onClick={() => setShowJoystick((v) => !v)}
            aria-label="Toggle touch joystick"
            className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-lg cursor-pointer ${
              showJoystick
                ? 'border-[#FFA94D] bg-[#FFA94D] text-[#1F1D2B]'
                : 'border-[#FFA94D]/30 bg-[#1F1D2B]/92 text-[#FFF8EF] hover:border-[#FF7A00]'
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden sm:inline">Joystick</span>
          </button>
        )}
      </div>
    </div>
  );
};
