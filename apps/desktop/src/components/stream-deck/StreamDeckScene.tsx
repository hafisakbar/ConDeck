import { Canvas } from '@react-three/fiber';
import type { DeckButtonWithAction } from '@condeck/shared';
import { Suspense } from 'react';
import type { ExecutionState } from '../../stores/deck-store';
import { StreamDeckDevice } from './StreamDeckDevice';
import type { ButtonLayout } from './grid-layout';

export interface StreamDeckSceneProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  layout: ButtonLayout;
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  operate: boolean;
  scale: number;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
}

/** Fixed three-quarter camera; no free orbit, so pressing a key is never a guess. */
export function StreamDeckScene({
  columns,
  rows,
  buttons,
  layout,
  selectedButtonId,
  executions,
  operate,
  scale,
  onSelect,
  onActivate,
}: StreamDeckSceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 6.2, 9.2], fov: 30, near: 0.1, far: 80 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0.15, 0);
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#9aa8c4', '#0a0c11', 0.5]} />
      <directionalLight position={[4.2, 7.8, 5.2]} intensity={2.7} color="#f3f6ff" />
      <directionalLight position={[-6, 3.6, -2.5]} intensity={1.15} color="#6a7bb5" />
      <spotLight
        position={[-2.6, 6.4, 3.6]}
        angle={0.55}
        penumbra={0.8}
        intensity={2.4}
        distance={20}
        color="#dfe6ff"
      />
      <pointLight position={[0, 1.4, 1.6]} intensity={5} distance={7} color="#7657ff" />

      <Suspense fallback={null}>
        <group scale={scale} position={[0, scale < 0.9 ? 0.2 : 0, 0]}>
          <StreamDeckDevice
            columns={columns}
            rows={rows}
            buttons={buttons}
            layout={layout}
            selectedButtonId={selectedButtonId}
            executions={executions}
            operate={operate}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        </group>
      </Suspense>
    </Canvas>
  );
}
