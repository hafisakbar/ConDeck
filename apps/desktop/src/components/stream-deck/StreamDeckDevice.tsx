import type { DeckButtonWithAction } from '@condeck/shared';
import { ContactShadows, RoundedBox } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { ExecutionState } from '../../stores/deck-store';
import { StreamDeckButton3D } from './StreamDeckButton3D';
import { slotPosition, type ButtonLayout } from './grid-layout';

function useWordmarkTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = 'rgba(226, 232, 240, 0.32)';
      context.font = '600 62px "Segoe UI", Inter, system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.letterSpacing = '22px';
      context.fillText('CONDECK', canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }, []);
}

export interface StreamDeckDeviceProps {
  columns: number;
  rows: number;
  buttons: DeckButtonWithAction[];
  layout: ButtonLayout;
  selectedButtonId: string | null;
  executions: Record<string, ExecutionState>;
  operate: boolean;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
}

/**
 * The physical device. Proportions follow the reference: a thick graphite body
 * on a kickstand, an inset well, a metal top plate, and one socketed key per
 * slot. Geometry is derived from the deck dimensions, so 5 × 3 and 8 × 8 render
 * as real, different devices.
 */
export function StreamDeckDevice({
  columns,
  rows,
  buttons,
  layout,
  selectedButtonId,
  executions,
  operate,
  onSelect,
  onActivate,
}: StreamDeckDeviceProps) {
  const wordmark = useWordmarkTexture();
  const byPosition = new Map(buttons.map((button) => [button.position, button]));
  const slots = Array.from({ length: columns * rows }, (_, position) => position);
  const casingWidth = layout.width + 1.05;
  const casingDepth = layout.depth + 1.45;
  const lastSlot = slotPosition(slots.length - 1, columns, rows, layout);
  const wordmarkZ = lastSlot.z + layout.size / 2 + 0.52;

  return (
    <group rotation={[0.3, -0.05, 0]} position={[0, 0.1, 0]}>
      {/* Kickstand legs */}
      {[-casingWidth * 0.29, casingWidth * 0.29].map((legX) => (
        <group key={legX}>
          <mesh position={[legX, -0.62, -casingDepth / 2 + 0.34]} rotation={[1.1, 0, 0]} castShadow>
            <boxGeometry args={[0.2, 0.1, 2.15]} />
            <meshStandardMaterial color="#101318" metalness={0.35} roughness={0.6} />
          </mesh>
          <mesh position={[legX, -1.18, 0.24]}>
            <cylinderGeometry args={[0.11, 0.11, 0.07, 24]} />
            <meshStandardMaterial color="#0a0c10" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* Body */}
      <RoundedBox args={[casingWidth, 0.58, casingDepth]} radius={0.2} smoothness={5} castShadow receiveShadow>
        <meshStandardMaterial color="#14171d" metalness={0.32} roughness={0.58} />
      </RoundedBox>

      {/* Metal top plate */}
      <RoundedBox
        args={[casingWidth - 0.04, 0.16, casingDepth - 0.04]}
        radius={0.065}
        smoothness={4}
        position={[0, 0.32, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1b1f26" metalness={0.45} roughness={0.4} />
      </RoundedBox>

      {/* Key well */}
      <RoundedBox
        args={[layout.width + 0.3, 0.09, layout.depth + 0.3]}
        radius={0.04}
        smoothness={4}
        position={[0, 0.375, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#080a0f" metalness={0.15} roughness={0.92} />
      </RoundedBox>

      {/* Accent strip above the wordmark */}
      <mesh position={[0, 0.405, wordmarkZ - 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.1, 0.025]} />
        <meshBasicMaterial color="#7657ff" transparent opacity={0.8} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0.404, wordmarkZ + 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.9, 0.45]} />
        <meshBasicMaterial map={wordmark} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      {slots.map((position) => {
        const button = byPosition.get(position) ?? null;
        return (
          <StreamDeckButton3D
            key={button?.id ?? `empty-${position}`}
            button={button}
            position={position}
            columns={columns}
            rows={rows}
            layout={layout}
            selected={button !== null && button.id === selectedButtonId}
            execution={button ? executions[button.id] : undefined}
            operate={operate}
            onSelect={onSelect}
            onActivate={onActivate}
          />
        );
      })}

      <ContactShadows
        position={[0, -1.24, 0.15]}
        opacity={0.62}
        scale={30}
        blur={2.8}
        far={7}
        resolution={512}
        color="#000000"
      />
    </group>
  );
}
