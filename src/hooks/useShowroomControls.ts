import { useCallback, useEffect, useRef, useState } from 'react';

export interface MovementKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

export interface JoystickVector {
  x: number; // -1..1
  y: number; // -1..1
}

export function useShowroomControls(containerRef: React.RefObject<HTMLDivElement | null>) {
  const keysRef = useRef<MovementKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const joystickRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const lookDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [zoomFov, setZoomFov] = useState(56);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
      }
    };

    const onBlur = () => {
      keysRef.current = { forward: false, backward: false, left: false, right: false };
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const zoomIn = useCallback(() => {
    setZoomFov((prev) => Math.max(34, prev - 6));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomFov((prev) => Math.min(72, prev + 6));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomFov(56);
  }, []);

  const setJoystick = useCallback((vec: JoystickVector) => {
    joystickRef.current = vec;
  }, []);

  const addLookDelta = useCallback((dx: number, dy: number) => {
    lookDeltaRef.current.dx += dx;
    lookDeltaRef.current.dy += dy;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [containerRef]);

  return {
    keysRef,
    joystickRef,
    lookDeltaRef,
    zoomFov,
    zoomIn,
    zoomOut,
    resetZoom,
    setJoystick,
    addLookDelta,
    isFullscreen,
    toggleFullscreen,
  };
}
