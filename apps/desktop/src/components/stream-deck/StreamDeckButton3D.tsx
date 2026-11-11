import { defaultButtonAppearance, type ButtonAppearance, type DeckButtonWithAction } from '@condeck/shared';
import { RoundedBox } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { buttonGlowLift, resolveButtonVisualState } from '../../lib/button-visual';
import type { ExecutionState } from '../../stores/deck-store';
import { useIconSource } from '../../stores/icon-store';
import { slotPosition, type ButtonLayout } from './grid-layout';
import { useButtonFaceTexture } from './useButtonFaceTexture';

const PRESS_TRAVEL = 0.05;
const REST_Y = 0.43;
/** How long a key stays visually depressed after a tap. */
const PRESS_RELEASE_MS = 190;
/** Pointer travel, in page pixels, that turns a press into an orbit drag. */
const TAP_SLOP = 6;
const DISABLED_TEXT = '#79818f';
const EMPTY_TEXT = '#8b94a5';
const DISABLED_TINT = '#11151c';
const RIM_BASE_GLOW = 0.04;

/**
 * Decorative meshes stay out of raycasting. The face plane used to sit just
 * above the cap, so the pointer crossed two different meshes while travelling
 * over one key and hover could flip on and off.
 */
const ignoreRaycast = (): void => {};

/**
 * Cursor ownership is shared by all keys: pointerout on one key can arrive
 * before pointerover on the next, so the cursor is only cleared once no key is
 * hovered.
 */
const hoveredKeys = new Set<number>();
function setHoverCursor(position: number, hovered: boolean): void {
  if (hovered) {
    hoveredKeys.add(position);
  } else {
    hoveredKeys.delete(position);
  }
  document.body.style.cursor = hoveredKeys.size > 0 ? 'pointer' : '';
}

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
 *
 * Only the cap is interactive; the rim, socket, label and halo are decoration.
 * The cap is opaque so the renderer never sorts it against its own children,
 * and the label rides on the cap so it sinks with the key instead of hovering
 * over a pressed face.
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
  const tapStart = useRef<{ x: number; y: number } | null>(null);

  const { x, z } = slotPosition(position, columns, rows, layout);
  const size = layout.size;
  const disabled = button !== null && !button.isEnabled;
  const empty = button === null;

  const palette = appearance ?? defaultButtonAppearance(button?.backgroundColor, button?.textColor);
  const visual = resolveButtonVisualState({ disabled, pressed, hovered, active, selected });
  const state = palette[visual];

  // White face + material tint: no canvas rebuilds when the pointer moves.
  const iconImageUrl = useIconSource(button?.icon ?? null);
  const texture = useButtonFaceTexture({
    label: button?.label ?? null,
    icon: button?.icon ?? null,
    iconImageUrl,
    empty,
  });

  const faceMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        color: new THREE.Color(EMPTY_TEXT),
      }),
    [],
  );

  const capMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(palette.normal.backgroundColor),
        emissive: new THREE.Color(palette.normal.glowColor),
        emissiveIntensity: 0.32,
        // Satin rather than glass: the old clearcoat 0.9 / roughness 0.22 cap
        // turned every stage light into a white blob that hid the key colour.
        roughness: 0.42,
        metalness: 0.06,
        clearcoat: 0.25,
        clearcoatRoughness: 0.5,
      }),
    // The palette is applied per frame; the material instance stays stable.
    [],
  );

  const disabledTint = useMemo(() => new THREE.Color(DISABLED_TINT), []);

  const target = useMemo(
    () => ({
      background: new THREE.Color(state.backgroundColor),
      border: new THREE.Color(state.borderColor),
      glow: new THREE.Color(state.glowColor),
      text: new THREE.Color(disabled ? DISABLED_TEXT : empty ? EMPTY_TEXT : state.textColor),
      glowIntensity: state.glowIntensity,
    }),
    [
      state.backgroundColor,
      state.borderColor,
      state.glowColor,
      state.textColor,
      state.glowIntensity,
      disabled,
      empty,
    ],
  );

  useEffect(() => {
    faceMaterial.map = texture;
    faceMaterial.needsUpdate = true;
  }, [faceMaterial, texture]);

  useEffect(
    () => () => {
      capMaterial.dispose();
      faceMaterial.dispose();
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [capMaterial, faceMaterial],
  );

  // Never leave the pointer cursor behind when a key disappears.
  useEffect(
    () => () => {
      tapStart.current = null;
      setHoverCursor(position, false);
    },
    [position],
  );

  // A held key stays visually down and springs back after release, even when
  // the release lands outside the cap or the orbit controls captured the drag.
  useEffect(() => {
    if (!pressed) {
      return;
    }
    const end = (): void => scheduleRelease();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [pressed]);

  const running = execution?.status === 'running';
  const success = execution?.status === 'success';
  const failed = execution?.status === 'failed';
  const statusColor = running ? '#ffffff' : success ? '#35c07d' : failed ? '#e25763' : null;

  useFrame((_, delta) => {
    // Solenoid-like travel: fast in, slightly slower spring back.
    const pressTarget = pressed ? 1 : 0;
    pressRef.current = THREE.MathUtils.damp(pressRef.current, pressTarget, pressed ? 34 : 18, delta);
    if (group.current) {
      group.current.position.y = REST_Y - pressRef.current * PRESS_TRAVEL;
    }
    if (cap.current) {
      cap.current.scale.setScalar(1 - pressRef.current * 0.012);
    }

    const settle = 1 - Math.exp(-14 * delta);
    capMaterial.color.lerp(disabled ? disabledTint : target.background, settle);
    capMaterial.emissive.lerp(target.glow, settle);
    const glowTarget = disabled ? 0.02 : target.glowIntensity * buttonGlowLift(visual) * 1.45;
    capMaterial.emissiveIntensity = THREE.MathUtils.damp(
      capMaterial.emissiveIntensity,
      glowTarget,
      9,
      delta,
    );

    faceMaterial.color.lerp(target.text, settle);
    faceMaterial.opacity = THREE.MathUtils.damp(faceMaterial.opacity, disabled ? 0.45 : 1, 12, delta);

    if (rimMaterial.current) {
      rimMaterial.current.color.lerp(target.border, settle);
      rimMaterial.current.emissive.lerp(target.border, settle);
      const rimGlow = disabled
        ? 0
        : selected
          ? 0.7
          : active
            ? 0.45
            : hovered
              ? 0.16
              : RIM_BASE_GLOW;
      rimMaterial.current.emissiveIntensity = THREE.MathUtils.damp(
        rimMaterial.current.emissiveIntensity,
        rimGlow,
        10,
        delta,
      );
    }
  });

  function scheduleRelease(): void {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setPressed(false), PRESS_RELEASE_MS);
  }

  function beginPress(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    tapStart.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    setPressed(true);
  }

  /**
   * Commit on release, not on both pointerdown and click. Pressing used to run
   * the action twice, and starting an orbit drag on a key ran it as well.
   */
  function releasePress(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    const start = tapStart.current;
    tapStart.current = null;
    scheduleRelease();
    if (!start) {
      return;
    }
    const moved = Math.hypot(event.nativeEvent.clientX - start.x, event.nativeEvent.clientY - start.y);
    if (moved > TAP_SLOP) {
      return;
    }
    if (!button) {
      onSelect(position, null);
      return;
    }
    if (operate && button.isEnabled) {
      onActivate(button.id);
      return;
    }
    onSelect(position, button.id);
  }

  function cancelPress(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    tapStart.current = null;
    scheduleRelease();
  }

  function beginHover(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    setHovered(true);
    setHoverCursor(position, true);
  }

  function endHover(event: ThreeEvent<PointerEvent>): void {
    event.stopPropagation();
    setHovered(false);
    setHoverCursor(position, false);
  }

  return (
    <group ref={group} position={[x, REST_Y, z]}>
      {/* Socket recessed into the chassis */}
      <mesh position={[0, -0.05, 0]} receiveShadow raycast={ignoreRaycast}>
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
        raycast={ignoreRaycast}
      >
        <meshStandardMaterial
          ref={rimMaterial}
          color={palette.normal.borderColor}
          emissive={palette.normal.borderColor}
          emissiveIntensity={selected ? 0.7 : 0.05}
          metalness={0.62}
          roughness={0.34}
        />
      </RoundedBox>

      {/* Keycap: the only mesh that takes pointer events */}
      <RoundedBox
        ref={cap}
        args={[size - 0.06, 0.17, size - 0.06]}
        radius={0.045}
        smoothness={5}
        position={[0, 0.1, 0]}
        castShadow
        onPointerDown={beginPress}
        onPointerUp={releasePress}
        onPointerCancel={cancelPress}
        onPointerOver={beginHover}
        onPointerOut={endHover}
      >
        <primitive object={capMaterial} attach="material" />

        {/* Icon and label, riding on the cap so they sink with the press */}
        <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRaycast}>
          <planeGeometry args={[size * 0.88, size * 0.88]} />
          <primitive object={faceMaterial} attach="material" />
        </mesh>

        {statusColor ? (
          <mesh position={[size / 2 - 0.14, 0.1, -size / 2 + 0.14]} raycast={ignoreRaycast}>
            <sphereGeometry args={[0.027, 12, 12]} />
            <meshBasicMaterial color={statusColor} toneMapped={false} />
          </mesh>
        ) : null}
      </RoundedBox>

      {selected ? (
        <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={ignoreRaycast}>
          <planeGeometry args={[size + 0.18, size + 0.18]} />
          <meshBasicMaterial
            color={palette.active.borderColor}
            transparent
            opacity={0.2}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}
