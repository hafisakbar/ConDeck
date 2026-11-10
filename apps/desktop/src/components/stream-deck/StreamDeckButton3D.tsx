import { defaultButtonAppearance, type ButtonAppearance, type DeckButtonWithAction } from '@condeck/shared';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ExecutionState } from '../../stores/deck-store';
import { slotPosition, type ButtonLayout } from './grid-layout';
import { useButtonFaceTexture } from './useButtonFaceTexture';

const PRESS_TRAVEL = 0.05;
const REST_Y = 0.43;

export interface StreamDeckButton3DProps {
  button: DeckButtonWithAction | null;
  position: number;
  columns: number;
  rows: number;
  layout: ButtonLayout;
  selected: boolean;
  active: boolean;
  appearance: ButtonAppearance | null;
  execution: ExecutionState | undefined;
  operate: boolean;
  onSelect: (position: number, buttonId: string | null) => void;
  onActivate: (buttonId: string) => void;
}

/**
 * One physical key. The socket sits in the chassis well, the metal rim frames
 * the cap, and the cap itself carries the illuminated face and its label
 * texture. Colours and glow come from the key's stored appearance, one palette
 * per interaction state, and every transition is damped so it feels mechanical
 * rather than animated.
 */
export function StreamDeckButton3D({
  button,
  position,
  columns,
  rows,
  layout,
  selected,
  active,
  appearance,
  execution,
  operate,
  onSelect,
  onActivate,
}: StreamDeckButton3DProps) {
  const group = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);
  const rimMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const pressRef = useRef(0);
  const timer = useRef<number | null>(null);

  const { x, z } = slotPosition(position, columns, rows, layout);
  const size = layout.size;
  const disabled = button !== null && !button.isEnabled;
  const empty = button === null;

  const palette = appearance ?? defaultButtonAppearance(button?.backgroundColor, button?.textColor);
  const visual = disabled
    ? 'normal'
    : pressed
      ? 'pressed'
      : active
        ? 'active'
        : hovered
          ? 'hover'
          : 'normal';
  const state = palette[visual];

  const texture = useButtonFaceTexture({
    label: button?.label ?? null,
    icon: button?.icon ?? null,
    textColor: disabled ? '#7b8291' : state.textColor,
    empty,
  });

  const target = useMemo(
    () => ({
      background: new THREE.Color(state.backgroundColor),
      text: new THREE.Color(state.textColor),
      border: new THREE.Color(state.borderColor),
      glow: new THREE.Color(state.glowColor),
      glowIntensity: state.glowIntensity,
    }),
    [state.backgroundColor, state.textColor, state.borderColor, state.glowColor, state.glowIntensity],
  );

  const capMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(palette.normal.backgroundColor),
        emissive: new THREE.Color(palette.normal.glowColor),
        emissiveIntensity: 0.35,
        roughness: 0.22,
        metalness: 0.1,
        clearcoat: 0.9,
        clearcoatRoughness: 0.18,
        transparent: true,
        opacity: 1,
      }),
    // The palette is applied per frame; the material instance stays stable.
    [],
  );

  useEffect(
    () => () => {
      capMaterial.dispose();
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [capMaterial],
  );

  const running = execution?.status === 'running';
  const success = execution?.status === 'success';
  const failed = execution?.status === 'failed';

  useFrame((_, delta) => {
    // Solenoid-like travel: fast in, slightly slower spring back.
    const pressTarget = pressed ? 1 : 0;
    pressRef.current = THREE.MathUtils.damp(
      pressRef.current,
      pressTarget,
      pressed ? 34 : 18,
      delta,
    );
    if (group.current) {
      group.current.position.y = REST_Y - pressRef.current * PRESS_TRAVEL;
    }
    if (cap.current) {
      cap.current.scale.setScalar(1 - pressRef.current * 0.012);
    }

    const lift = pressed ? 1.5 : active ? 1.35 : hovered ? 1.15 : 0.92;
    capMaterial.color.lerp(target.background, 1 - Math.exp(-12 * delta));
    capMaterial.emissive.lerp(target.glow, 1 - Math.exp(-10 * delta));
    const glowTarget = disabled ? 0.05 : target.glowIntensity * lift * 1.6;
    capMaterial.emissiveIntensity = THREE.MathUtils.damp(
      capMaterial.emissiveIntensity,
      glowTarget,
      9,
      delta,
    );
    capMaterial.opacity = THREE.MathUtils.damp(
      capMaterial.opacity,
      disabled ? 0.42 : 1,
      12,
      delta,
    );

    if (rimMaterial.current) {
      rimMaterial.current.color.lerp(target.border, 1 - Math.exp(-12 * delta));
      rimMaterial.current.emissive.lerp(target.border, 1 - Math.exp(-10 * delta));
      const rimGlow = disabled ? 0 : selected ? 0.9 : active ? 0.85 : hovered ? 0.35 : 0.06;
      rimMaterial.current.emissiveIntensity = THREE.MathUtils.damp(
        rimMaterial.current.emissiveIntensity,
        rimGlow,
        10,
        delta,
      );
    }
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
    timer.current = window.setTimeout(() => setPressed(false), 170);
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
    <group ref={group} position={[x, REST_Y, z]}>
      {/* Socket recessed into the chassis */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[size + 0.2, 0.14, size + 0.2]} />
        <meshStandardMaterial color="#07090d" roughness={0.95} metalness={0.05} />
      </mesh>

      {/* Metal rim, lit in the key's border colour */}
      <RoundedBox
        args={[size + 0.06, 0.13, size + 0.06]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.015, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={rimMaterial}
          color={palette.normal.borderColor}
          emissive={palette.normal.borderColor}
          emissiveIntensity={selected ? 0.8 : 0.05}
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
          <meshBasicMaterial
            color={palette.active.borderColor}
            transparent
            opacity={0.26}
            depthWrite={false}
          />
        </mesh>
      ) : null}

      {running ? (
        <mesh position={[size / 2 - 0.14, 0.2, -size / 2 + 0.14]}>
          <sphereGeometry args={[0.026, 12, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ) : success ? (
        <mesh position={[size / 2 - 0.14, 0.2, -size / 2 + 0.14]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color="#35c07d" toneMapped={false} />
        </mesh>
      ) : failed ? (
        <mesh position={[size / 2 - 0.14, 0.2, -size / 2 + 0.14]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshBasicMaterial color="#e25763" toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
