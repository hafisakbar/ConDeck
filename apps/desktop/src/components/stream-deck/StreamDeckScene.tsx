import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { ButtonAppearance, DeckButtonWithAction, ObsSnapshot } from '@condeck/shared';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ExecutionState } from '../../stores/deck-store';
import { StreamDeckDevice } from './StreamDeckDevice';
import type { ButtonLayout } from './grid-layout';

/** Gestures the page and toolbar can drive without touching three.js directly. */
export interface StreamDeckViewHandle {
  /** Restore the default three-quarter angle, keeping the current zoom. */
  reset: () => void;
  /** Restore the default angle and frame the whole device. */
  fit: () => void;
  /** Set zoom as a factor of the fitted distance (1 = fitted). */
  setZoom: (zoom: number) => void;
}

const DEFAULT_AZIMUTH = 0;
const DEFAULT_POLAR = 1.02;
const MIN_POLAR = 0.3;
const MAX_POLAR = 1.34;
const MAX_AZIMUTH = 0.95;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.6;
const FOV = 30;

interface OrbitControlsLike {
  object: THREE.Camera;
  target: THREE.Vector3;
  update: () => void;
}

export interface StreamDeckSceneProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  layout: ButtonLayout;
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  appearanceDraft: Record<string, ButtonAppearance>;
  obs: ObsSnapshot | null;
  operate: boolean;
  scale: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
  onViewReady: (view: StreamDeckViewHandle | null) => void;
}

function fittedDistance(layout: ButtonLayout, aspect: number): number {
  const width = layout.width + 1.05;
  const depth = layout.depth + 1.45;
  const vertical = 2 * Math.tan((FOV * Math.PI) / 360);
  const byHeight = depth / vertical;
  const byWidth = width / (vertical * Math.max(aspect, 0.6));
  return Math.max(byHeight, byWidth) * 0.9 + 1.25;
}

interface DeviceStageProps extends Omit<StreamDeckSceneProps, 'zoom' | 'onZoomChange' | 'onViewReady'> {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onViewReady: (view: StreamDeckViewHandle | null) => void;
}

function DeviceStage({
  zoom,
  onZoomChange,
  onViewReady,
  layout,
  ...rest
}: DeviceStageProps) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsLike | null>(null);
  const baseDistance = useMemo(
    () => fittedDistance(layout, size.width / Math.max(size.height, 1)),
    [layout, size.width, size.height],
  );
  const lastReported = useRef(zoom);

  function angle(azimuth: number, polar: number, distance: number): void {
    const target = new THREE.Vector3(0, 0.1, 0);
    camera.position.set(
      target.x + distance * Math.sin(polar) * Math.sin(azimuth),
      target.y + distance * Math.cos(polar),
      target.z + distance * Math.sin(polar) * Math.cos(azimuth),
    );
    camera.lookAt(target);
    if (controls.current) {
      controls.current.target.copy(target);
      controls.current.update();
    }
  }

  function currentDistance(): number {
    return camera.position.distanceTo(new THREE.Vector3(0, 0.1, 0));
  }

  // Frame the device whenever its grid changes, keeping the angle the user chose.
  useEffect(() => {
    angle(DEFAULT_AZIMUTH, DEFAULT_POLAR, baseDistance);
    lastReported.current = 1;
  }, [baseDistance]);

  useEffect(() => {
    onViewReady({
      reset: () => angle(DEFAULT_AZIMUTH, DEFAULT_POLAR, currentDistance()),
      fit: () => {
        angle(DEFAULT_AZIMUTH, DEFAULT_POLAR, baseDistance);
        onZoomChange(1);
        lastReported.current = 1;
      },
      setZoom: (next) => {
        const clamped = THREE.MathUtils.clamp(next, MIN_ZOOM, MAX_ZOOM);
        angle(DEFAULT_AZIMUTH, DEFAULT_POLAR, baseDistance / clamped);
        onZoomChange(clamped);
        lastReported.current = clamped;
      },
    });
    return () => onViewReady(null);
  }, [baseDistance, camera, onViewReady, onZoomChange]);

  return (
    <>
      <OrbitControls
        ref={(instance) => {
          controls.current = instance as unknown as OrbitControlsLike | null;
        }}
        makeDefault
        target={[0, 0.1, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.075}
        rotateSpeed={0.5}
        zoomSpeed={0.7}
        minDistance={baseDistance / MAX_ZOOM}
        maxDistance={baseDistance / MIN_ZOOM}
        minPolarAngle={MIN_POLAR}
        maxPolarAngle={MAX_POLAR}
        minAzimuthAngle={-MAX_AZIMUTH}
        maxAzimuthAngle={MAX_AZIMUTH}
        onEnd={() => {
          const next = THREE.MathUtils.clamp(baseDistance / currentDistance(), MIN_ZOOM, MAX_ZOOM);
          if (Math.abs(next - lastReported.current) > 0.01) {
            lastReported.current = next;
            onZoomChange(next);
          }
        }}
      />

      <group scale={rest.scale} position={[0, rest.scale < 0.9 ? 0.2 : 0, 0]}>
        <StreamDeckDevice {...rest} columns={rest.columns} rows={rest.rows} layout={layout} />
      </group>
    </>
  );
}

/**
 * The interactive stage. The camera orbits within fixed limits so the device
 * never leaves the frame; keys remain clickable because OrbitControls only
 * starts a drag after movement.
 */
export function StreamDeckScene({
  columns,
  rows,
  buttons,
  layout,
  selectedButtonId,
  executions,
  appearanceDraft,
  obs,
  operate,
  scale,
  zoom,
  onZoomChange,
  onSelect,
  onActivate,
  onViewReady,
}: StreamDeckSceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMappingExposure: 0.95 }}
      camera={{ position: [0, 6.2, 9.2], fov: FOV, near: 0.1, far: 80 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      {/*
        Stage lighting is deliberately diffuse. A point light used to sit just
        above the middle keys, which pooled purple light on one key and washed
        out its stored colour; it is gone, and the keycaps are the only coloured
        emitters now. Two directionals from opposite corners plus a wide top wash
        keep the chassis readable from either side without blowing out highlights,
        while the low exposure preserves the material's graphite tone.
      */}
      <ambientLight intensity={0.3} color="#c6d0e4" />
      <hemisphereLight args={['#c2cce0', '#0a0c11', 0.46]} />
      <directionalLight position={[5.2, 8.6, 5.4]} intensity={1.32} color="#eef3ff" />
      <directionalLight position={[-6.6, 4.4, 3.4]} intensity={0.68} color="#9dafd2" />
      <directionalLight position={[-1.6, 5.6, -6.4]} intensity={0.5} color="#b9c6e0" />
      <directionalLight position={[0, 2.4, 7.5]} intensity={0.32} color="#dfe7f7" />
      <spotLight
        position={[0, 8.8, 3.2]}
        angle={1.05}
        penumbra={1}
        intensity={0.55}
        distance={34}
        color="#e9eeff"
      />

      <Suspense fallback={null}>
        <DeviceStage
          columns={columns}
          rows={rows}
          buttons={buttons}
          layout={layout}
          selectedButtonId={selectedButtonId}
          executions={executions}
          appearanceDraft={appearanceDraft}
          obs={obs}
          operate={operate}
          scale={scale}
          zoom={zoom}
          onZoomChange={onZoomChange}
          onSelect={onSelect}
          onActivate={onActivate}
          onViewReady={onViewReady}
        />
      </Suspense>
    </Canvas>
  );
}
