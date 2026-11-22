import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  resolveShowroomCollision,
  SHOWROOM_MANNEQUINS,
  type ShowroomRack,
} from '../../data/showroomLayout';
import {
  getShowroomSectionById,
  SHOWROOM_ENTRANCE_CAMERA,
  type ShowroomSectionId,
} from '../../data/showroomSections';
import type { ShowroomProduct } from '../../data/showroomProducts';
import type { CameraTargetState, PlayerTelemetry } from '../../hooks/useShowroomNavigation';
import type { JoystickVector, MovementKeys } from '../../hooks/useShowroomControls';
import { getQualitySettings, type RenderQuality } from '../../utils/webglDetect';
import { ShowroomLighting } from './ShowroomLighting';
import { ShowroomFloor } from './ShowroomFloor';
import { ShowroomWalls } from './ShowroomWalls';
import { ShowroomEntrance } from './ShowroomEntrance';
import { ClothingRack } from './ClothingRack';
import { FashionMannequin } from './FashionMannequin';

// Pre-allocated vectors outside render loop (zero per-frame GC)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface CameraRigProps {
  cameraGoalRef: React.MutableRefObject<CameraTargetState>;
  keysRef: React.MutableRefObject<MovementKeys>;
  joystickRef: React.MutableRefObject<JoystickVector>;
  lookDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  zoomFov: number;
  guidedMode: boolean;
  hasEntered: boolean;
  onTelemetry: (pos: PlayerTelemetry) => void;
  onArriveClickTarget: () => void;
}

const CameraRig: React.FC<CameraRigProps> = ({
  cameraGoalRef,
  keysRef,
  joystickRef,
  lookDeltaRef,
  zoomFov,
  guidedMode,
  hasEntered,
  onTelemetry,
  onArriveClickTarget,
}) => {
  const { camera, gl } = useThree();
  const yawRef = useRef(0);
  const pitchRef = useRef(-0.04);
  const isDraggingRef = useRef(false);
  const prevPointerRef = useRef({ x: 0, y: 0 });
  const telemetryAccumRef = useRef(0);

  // Set starting exterior entrance camera view
  useEffect(() => {
    camera.position.set(...SHOWROOM_ENTRANCE_CAMERA.outsidePos);
    camera.lookAt(...SHOWROOM_ENTRANCE_CAMERA.outsideLookAt);
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yawRef.current = _euler.y;
    pitchRef.current = _euler.x;
  }, [camera]);

  // Mouse drag & touch swipe 360-degree look controls directly on WebGL canvas
  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevPointerRef.current.x;
      const dy = e.clientY - prevPointerRef.current.y;
      prevPointerRef.current = { x: e.clientX, y: e.clientY };
      lookDeltaRef.current.dx += dx;
      lookDeltaRef.current.dy += dy;
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [gl, lookDeltaRef]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const persp = camera as THREE.PerspectiveCamera;

    // Smooth FOV zoom damping
    if (Math.abs(persp.fov - zoomFov) > 0.05) {
      persp.fov = THREE.MathUtils.damp(persp.fov, zoomFov, 7, delta);
      persp.updateProjectionMatrix();
    }

    const keys = keysRef.current;
    const joy = joystickRef.current;
    const hasManualMove =
      hasEntered &&
      !guidedMode &&
      (keys.forward ||
        keys.backward ||
        keys.left ||
        keys.right ||
        Math.abs(joy.x) > 0.05 ||
        Math.abs(joy.y) > 0.05);

    const hasManualLook =
      Math.abs(lookDeltaRef.current.dx) > 0.1 || Math.abs(lookDeltaRef.current.dy) > 0.1;

    // Cancel automated glide if user actively walks or looks manually
    if (hasManualMove || (hasEntered && hasManualLook)) {
      cameraGoalRef.current.active = false;
      onArriveClickTarget();
    }

    // Apply mouse/touch 360-degree look deltas
    if (hasManualLook) {
      yawRef.current -= lookDeltaRef.current.dx * 0.0042;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current - lookDeltaRef.current.dy * 0.0032,
        -0.58,
        0.58
      );
      lookDeltaRef.current.dx = 0;
      lookDeltaRef.current.dy = 0;
    }

    const goal = cameraGoalRef.current;
    if (goal.active) {
      // Smooth damped cinematic camera glide to entrance, section, or clicked floor point
      _desiredPos.set(goal.pos[0], goal.pos[1], goal.pos[2]);
      camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, 3.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, 3.2, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, 3.2, delta);

      _lookTarget.set(goal.lookAt[0], goal.lookAt[1], goal.lookAt[2]);
      const dirX = _lookTarget.x - camera.position.x;
      const dirY = _lookTarget.y - camera.position.y;
      const dirZ = _lookTarget.z - camera.position.z;
      const horizDist = Math.max(0.001, Math.hypot(dirX, dirZ));
      const targetYaw = Math.atan2(-dirX, -dirZ);
      const targetPitch = THREE.MathUtils.clamp(Math.atan2(dirY, horizDist), -0.5, 0.5);

      // Shortest angular interpolation for yaw
      let diffYaw = targetYaw - yawRef.current;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

      yawRef.current += diffYaw * (1 - Math.exp(-4.0 * delta));
      pitchRef.current = THREE.MathUtils.damp(pitchRef.current, targetPitch, 4.0, delta);

      if (camera.position.distanceTo(_desiredPos) < 0.12 && Math.abs(diffYaw) < 0.04) {
        goal.active = false;
        onArriveClickTarget();
      }
    } else if (hasManualMove) {
      const moveSpeed = 5.4;
      const inputForward =
        (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0) - joy.y;
      const inputStrafe =
        (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joy.x;

      _forward.set(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)).normalize();
      _right.set(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current)).normalize();

      const nextX =
        camera.position.x +
        (_forward.x * inputForward + _right.x * inputStrafe) * moveSpeed * delta;
      const nextZ =
        camera.position.z +
        (_forward.z * inputForward + _right.z * inputStrafe) * moveSpeed * delta;

      const [resolvedX, resolvedZ] = resolveShowroomCollision(nextX, nextZ);
      camera.position.x = resolvedX;
      camera.position.z = resolvedZ;
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.78, 6, delta);
    }

    // Apply orientation cleanly via YXZ Euler
    _euler.set(pitchRef.current, yawRef.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(_euler);

    // Throttled telemetry update for Mini-Map (~10 Hz to avoid React re-render overhead)
    telemetryAccumRef.current += delta;
    if (telemetryAccumRef.current > 0.1) {
      telemetryAccumRef.current = 0;
      onTelemetry({
        x: camera.position.x,
        z: camera.position.z,
        yaw: yawRef.current,
      });
    }
  });

  return null;
};

export interface ShowroomCanvasProps {
  racks: ShowroomRack[];
  productsById?: Record<string, ShowroomProduct>;
  activeSection: ShowroomSectionId;
  selectedProductId: string | null;
  doorsOpen: boolean;
  hasEntered: boolean;
  guidedMode: boolean;
  quality: RenderQuality;
  isSoftwareGl: boolean;
  zoomFov: number;
  clickTarget: [number, number, number] | null;
  cameraGoalRef: React.MutableRefObject<CameraTargetState>;
  keysRef: React.MutableRefObject<MovementKeys>;
  joystickRef: React.MutableRefObject<JoystickVector>;
  lookDeltaRef: React.MutableRefObject<{ dx: number; dy: number }>;
  onSelectProduct: (product: ShowroomProduct) => void;
  onFloorClick: (x: number, z: number) => void;
  onArriveClickTarget: () => void;
  onTelemetry: (pos: PlayerTelemetry) => void;
  onContextLost: () => void;
  onReady: () => void;
}

export const ShowroomCanvas: React.FC<ShowroomCanvasProps> = ({
  racks,
  productsById,
  activeSection,
  selectedProductId,
  doorsOpen,
  hasEntered,
  guidedMode,
  quality,
  isSoftwareGl,
  zoomFov,
  clickTarget,
  cameraGoalRef,
  keysRef,
  joystickRef,
  lookDeltaRef,
  onSelectProduct,
  onFloorClick,
  onArriveClickTarget,
  onTelemetry,
  onContextLost,
  onReady,
}) => {
  const settings = getQualitySettings(quality, isSoftwareGl);
  const currentSection = getShowroomSectionById(activeSection);

  return (
    <Canvas
      className="h-full w-full touch-none select-none"
      dpr={settings.dpr}
      shadows={settings.shadows}
      gl={{
        antialias: settings.antialias,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ fov: 56, near: 0.15, far: 85, position: SHOWROOM_ENTRANCE_CAMERA.outsidePos }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost();
        });
        onReady();
      }}
    >
      <color attach="background" args={['#1A1826']} />
      <fog attach="fog" args={['#1A1826', 24, 52]} />

      <ShowroomLighting
        shadowsEnabled={settings.shadows}
        shadowMapSize={settings.shadowMapSize}
        doorsOpen={doorsOpen}
      />

      <ShowroomFloor
        clickTarget={clickTarget}
        onFloorClick={(x, z) => {
          if (hasEntered && !guidedMode) {
            onFloorClick(x, z);
          }
        }}
      />

      <ShowroomWalls />
      <ShowroomEntrance doorsOpen={doorsOpen} />

      {/* Interactive Clothing Racks across all Showroom Sections */}
      {racks.map((rack) => (
        <ClothingRack
          key={rack.rackId}
          rack={rack}
          highlighted={currentSection.highlightRackIds.includes(rack.rackId)}
          selectedProductId={selectedProductId}
          productsById={productsById}
          onSelectProduct={onSelectProduct}
        />
      ))}

      {/* Sculpted 3D Fashion Mannequins */}
      {SHOWROOM_MANNEQUINS.map((mannequin) => (
        <FashionMannequin
          key={mannequin.id}
          config={mannequin}
          selected={selectedProductId === mannequin.productId}
          productsById={productsById}
          onSelectProduct={onSelectProduct}
        />
      ))}

      <CameraRig
        cameraGoalRef={cameraGoalRef}
        keysRef={keysRef}
        joystickRef={joystickRef}
        lookDeltaRef={lookDeltaRef}
        zoomFov={zoomFov}
        guidedMode={guidedMode}
        hasEntered={hasEntered}
        onTelemetry={onTelemetry}
        onArriveClickTarget={onArriveClickTarget}
      />
    </Canvas>
  );
};
