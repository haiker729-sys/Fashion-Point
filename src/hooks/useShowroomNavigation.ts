import { useCallback, useRef, useState } from 'react';
import {
  getShowroomSectionById,
  SHOWROOM_ENTRANCE_CAMERA,
  type ShowroomSectionId,
} from '../data/showroomSections';
import { showroomAudio } from '../utils/webglDetect';

export interface CameraTargetState {
  pos: [number, number, number];
  lookAt: [number, number, number];
  active: boolean;
}

export interface PlayerTelemetry {
  x: number;
  z: number;
  yaw: number; // radians
}

export function useShowroomNavigation() {
  const [hasEntered, setHasEntered] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ShowroomSectionId>('new-arrivals');
  const [guidedMode, setGuidedMode] = useState(false);
  const [sectionBanner, setSectionBanner] = useState<string | null>(null);
  const [clickTarget, setClickTarget] = useState<[number, number, number] | null>(null);
  const [playerPos, setPlayerPos] = useState<PlayerTelemetry>({ x: 0, z: 18, yaw: 0 });

  const cameraGoalRef = useRef<CameraTargetState>({
    pos: SHOWROOM_ENTRANCE_CAMERA.outsidePos,
    lookAt: SHOWROOM_ENTRANCE_CAMERA.outsideLookAt,
    active: false,
  });

  const bannerTimerRef = useRef<number | null>(null);

  const showBanner = useCallback((label: string) => {
    setSectionBanner(label);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => {
      setSectionBanner(null);
    }, 3200);
  }, []);

  const enterShowroom = useCallback(() => {
    setDoorsOpen(true);
    setHasEntered(true);
    cameraGoalRef.current = {
      pos: SHOWROOM_ENTRANCE_CAMERA.insidePos,
      lookAt: SHOWROOM_ENTRANCE_CAMERA.insideLookAt,
      active: true,
    };
    showBanner('Welcome to 3D Jummo Fashion World');
    showroomAudio.playChime(523.25);
  }, [showBanner]);

  const navigateToSection = useCallback(
    (sectionId: ShowroomSectionId) => {
      const section = getShowroomSectionById(sectionId);
      setActiveSection(sectionId);
      setClickTarget(null);
      cameraGoalRef.current = {
        pos: [...section.cameraPos],
        lookAt: [...section.lookAt],
        active: true,
      };
      showBanner(section.name);
      showroomAudio.playChime(659.25);
    },
    [showBanner]
  );

  const walkToPoint = useCallback((x: number, z: number) => {
    setClickTarget([x, 0.03, z]);
    cameraGoalRef.current = {
      pos: [x, 1.78, z],
      lookAt: [x, 1.65, z - 4],
      active: true,
    };
    showroomAudio.playChime(440);
  }, []);

  const cancelAutoTransition = useCallback(() => {
    cameraGoalRef.current.active = false;
  }, []);

  return {
    hasEntered,
    doorsOpen,
    activeSection,
    guidedMode,
    setGuidedMode,
    sectionBanner,
    clickTarget,
    setClickTarget,
    playerPos,
    setPlayerPos,
    cameraGoalRef,
    enterShowroom,
    navigateToSection,
    walkToPoint,
    cancelAutoTransition,
  };
}
