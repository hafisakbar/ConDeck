import type { DeckButtonWithAction } from '@condeck/shared';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ExecutionState } from '../../stores/deck-store';
import { slotPosition, type ButtonLayout } from './grid-layout';
import { useButtonFaceTexture } from './useButtonFaceTexture';

const accent = new THREE.Color('#8a70ff');
const success = new THREE.Color('#35c07d');
const danger = new THREE.Color('#e25763');

export interface StreamDeckButton3DProps {
  button: DeckButtonWithAction | null;
  position: number;
  columns: number;
  rows: number;
  layout: ButtonLayout;
  selected: boolean;
  execution: ExecutionState | undefined;
  operate: boolean;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
}

/**
 * One physical key. The socket sits in the chassis well, the metal rim frames
 * the cap, and the cap itself carries the illuminated face and its label
 * texture. The cap mesh is the raycast target for select and press.
 */
export function StreamDeckButton3D({
  button,
  position,
  columns,
  rows,
  layout,
  selected,
  execution,
  operate,
  onSelect,
  onActivate,
}: StreamDeckButton3DProps) {
  const group = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const pressRef = useRef(0);
  const timer = useRef<number | null>(null);

  const { x, z } = slotPosition(position, columns, rows, layout);
  const size = layout.size;
  const disabled = button !== null && !button.isEnabled;
  const empty = button === null;

  const texture = useButtonFaceTexture({
    label: button?.label ?? null,
    icon: button?.icon ?? null,
    textColor: button?.textColor ?? '#cfd6e3',
    empty,
  });

  const faceColor = useMemo(
    () => new THREE.Color(button?.backgroundColor ?? '#12151c'),
    [button?.backgroundColor],
  );

  const capMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: faceColor,
        emissive: faceColor,
        emissiveIntensity: 0.5,
        roughness: 0.22,
        metalness: 0.1,
        clearcoat: 0.9,
        clearcoatRoughness: 0.18,
        transparent: true,
        opacity: 1,
      }),
    // The colour is copied in the effect below; the material instance stays stable.
    [],
  );

  useEffect(() => {
    capMaterial.color.copy(faceColor);
    capMaterial.emissive.copy(faceColor);
  }, [capMaterial, faceColor]);

  useEffect(() => {
    capMaterial.opacity = disabled ? 0.5 : 1;
    capMaterial.needsUpdate = true;
  }, [capMaterial, disabled]);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  const running = execution?.status === 'running';
  const tone =
    execution && execution.status !== 'running'
      ? execution.status === 'failed'
        ? danger
        : success
      : null;

  useFrame((_, delta) => {
    const target = pressed ? 1 : 0;
    pressRef.current = THREE.MathUtils.damp(pressRef.current, target, 20, delta);
    if (group.current) {
      group.current.position.y = 0.43 - pressRef.current * 0.04 + (hovered ? 0.008 : 0);
    }
    if (cap.current) {
      cap.current.scale.setScalar(1 + (hovered ? 0.012 : 0) - pressRef.current * 0.008);
    }
    const glow = disabled ? 0.16 : pressed ? 1.35 : hovered ? 1.05 : selected ? 0.9 : 0.62;
    capMaterial.emissiveIntensity = THREE.MathUtils.damp(
      capMaterial.emissiveIntensity,
      glow,
      12,
      delta,
    );
  });

  function press(): void {
    if (!button) {
      onSelect(position, null);
      return;
    }
    setPressed(true);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setPressed(false), 150);
    if (operate && button.isEnabled) {
      onActivate(button.id);
      return;
    }
    onSelect(position, button.id);
  }

  function handlePointer(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    press();
  }

  return (
    <group ref={group} position={[x, 0.43, z]}>
      {/* Socket recessed into the chassis */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[size + 0.2, 0.14, size + 0.2]} />
        <meshStandardMaterial color="#07090d" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Brushed rim */}
      <RoundedBox
        args={[size + 0.06, 0.13, size + 0.06]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.015, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={selected ? '#2a2450' : '#20242c'}
          emissive={selected ? '#6a4dff' : '#000000'}
          emissiveIntensity={selected ? 0.7 : 0}
          metalness={0.62}
          roughness={0.34}
        />
      </RoundedBox>

      {/* Keycap */}
      <RoundedBox
        ref={cap}
        args={[size - 0.06, 0.17, size - 0.06]}
        radius={0.045}
        smoothness={5}
        position={[0, 0.1, 0]}
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          press();
        }}
        onPointerDown={handlePointer}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        <primitive object={capMaterial} attach="material" />
      </RoundedBox>

      {/* Icon and label projected onto the cap */}
      <mesh position={[0, 0.187, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size * 0.88, size * 0.88]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
          opacity={disabled ? 0.45 : 1}
        />
      </mesh>

      {selected ? (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size + 0.13, size + 0.13]} />
          <meshBasicMaterial color={accent} transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ) : null}

      {running ? (
        <mesh position={[size / 2 - 0.14, 0.2, -size / 2 + 0.14]}>
          <sphereGeometry args={[0.026, 12, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ) : tone ? (
        <mesh position={[size / 2 - 0.14, 0.2, -size / 2 + 0.14]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color={tone} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
