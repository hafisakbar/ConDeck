import type { ButtonIcon } from '@condeck/shared';
import { createElement, useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { resolveButtonIcon } from '../../lib/button-icons';

const TEXTURE_SIZE = 512;
const ICON_SIZE = 186;
const LABEL_FONT = '600 54px "Segoe UI", Inter, system-ui, sans-serif';
/** Drawn in white so the material can tint it without rebuilding the canvas. */
const FACE_INK = '#ffffff';

export interface ButtonFaceOptions {
  label: string | null;
  icon: ButtonIcon | null;
  /** Data URL of a custom uploaded icon; drawn as-is instead of a Lucide glyph. */
  iconImageUrl?: string | null;
  empty: boolean;
}

function wrapLabel(context: CanvasRenderingContext2D, text: string): string[] {
  const words = text.trim().split(/\s+/).slice(0, 8);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (context.measureText(candidate).width <= TEXTURE_SIZE - 72 || current.length === 0) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
    if (lines.length === 2) {
      break;
    }
  }
  if (lines.length < 2 && current.length > 0) {
    lines.push(current);
  }
  return lines.map((line) => (context.measureText(line).width > TEXTURE_SIZE - 60 ? `${line.slice(0, 12)}…` : line));
}

function drawFace(canvas: HTMLCanvasElement, options: ButtonFaceOptions): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = FACE_INK;

  if (options.empty) {
    context.strokeStyle = FACE_INK;
    context.globalAlpha = 0.55;
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(TEXTURE_SIZE / 2 - 34, TEXTURE_SIZE / 2);
    context.lineTo(TEXTURE_SIZE / 2 + 34, TEXTURE_SIZE / 2);
    context.moveTo(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 - 34);
    context.lineTo(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + 34);
    context.stroke();
    context.globalAlpha = 1;
    return;
  }

  const hasLabel = (options.label ?? '').trim().length > 0;
  const customSource = options.iconImageUrl ?? null;
  const iconMarkup =
    !customSource && options.icon !== null
      ? (() => {
          const Icon = resolveButtonIcon(options.icon);
          return Icon
            ? renderToStaticMarkup(
                createElement(Icon, { size: ICON_SIZE, color: FACE_INK, strokeWidth: 1.7 }),
              )
            : null;
        })()
      : null;
  const iconSource = customSource ??
    (iconMarkup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconMarkup)}` : null);

  if (iconSource) {
    const image = new Image();
    image.onload = () => {
      context.drawImage(
        image,
        (TEXTURE_SIZE - ICON_SIZE) / 2,
        hasLabel ? 82 : (TEXTURE_SIZE - ICON_SIZE) / 2,
        ICON_SIZE,
        ICON_SIZE,
      );
      canvas.dispatchEvent(new Event('condeck-texture-updated'));
    };
    image.src = iconSource;
  }

  if (hasLabel) {
    context.font = LABEL_FONT;
    const lines = wrapLabel(context, options.label ?? '');
    const startY = iconSource ? 352 : TEXTURE_SIZE / 2;
    lines.forEach((line, index) => {
      context.fillText(line, TEXTURE_SIZE / 2, startY + index * 58);
    });
  }
}

/**
 * Renders the face of one physical button into a canvas texture: the stored icon
 * plus its label, always in white. Colour is a material tint instead of part of
 * the drawing, so hovering a key never re-rasterises 64 canvases, and the label
 * fades between states instead of popping. Kept outside React's render tree so
 * the deck never becomes dozens of DOM overlays.
 */
export function useButtonFaceTexture(options: ButtonFaceOptions): THREE.CanvasTexture {
  const key = `${options.empty ? 'empty' : 'face'}|${options.label ?? ''}|${options.icon ?? ''}|${options.iconImageUrl ?? ''}`;
  const [revision, setRevision] = useState(0);

  const { canvas, texture } = useMemo(() => {
    const element = document.createElement('canvas');
    element.width = TEXTURE_SIZE;
    element.height = TEXTURE_SIZE;
    drawFace(element, options);
    const nextTexture = new THREE.CanvasTexture(element);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.anisotropy = 4;
    return { canvas: element, texture: nextTexture };
    // `key` captures every value drawFace reads.
  }, [key]);

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    canvas.addEventListener('condeck-texture-updated', bump);
    return () => canvas.removeEventListener('condeck-texture-updated', bump);
  }, [canvas]);

  useEffect(() => {
    texture.needsUpdate = true;
  }, [texture, revision]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
