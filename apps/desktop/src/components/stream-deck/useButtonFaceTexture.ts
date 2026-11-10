import type { ButtonIconName } from '@condeck/shared';
import { createElement, useEffect, useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { resolveButtonIcon } from '../../lib/button-icons';

const TEXTURE_SIZE = 512;
const ICON_SIZE = 186;
const LABEL_FONT = '600 54px "Segoe UI", Inter, system-ui, sans-serif';

export interface ButtonFaceOptions {
  label: string | null;
  icon: ButtonIconName | null;
  textColor: string;
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
  context.fillStyle = options.textColor;

  if (options.empty) {
    context.strokeStyle = 'rgba(226, 232, 240, 0.42)';
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(TEXTURE_SIZE / 2 - 34, TEXTURE_SIZE / 2);
    context.lineTo(TEXTURE_SIZE / 2 + 34, TEXTURE_SIZE / 2);
    context.moveTo(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 - 34);
    context.lineTo(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2 + 34);
    context.stroke();
    return;
  }

  const hasLabel = (options.label ?? '').trim().length > 0;
  const iconMarkup =
    options.icon !== null
      ? (() => {
          const Icon = resolveButtonIcon(options.icon);
          return Icon
            ? renderToStaticMarkup(
                createElement(Icon, { size: ICON_SIZE, color: options.textColor, strokeWidth: 1.7 }),
              )
            : null;
        })()
      : null;

  if (iconMarkup) {
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
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconMarkup)}`;
  }

  if (hasLabel) {
    context.font = LABEL_FONT;
    const lines = wrapLabel(context, options.label ?? '');
    const startY = iconMarkup ? 352 : TEXTURE_SIZE / 2;
    lines.forEach((line, index) => {
      context.fillText(line, TEXTURE_SIZE / 2, startY + index * 58);
    });
  }
}

/**
 * Renders the face of one physical button into a canvas texture: the stored icon
 * plus its label, in the button's own text colour. Kept outside React's render
 * tree so 64 buttons never become 64 DOM overlays over the 3D scene.
 */
export function useButtonFaceTexture(options: ButtonFaceOptions): THREE.CanvasTexture {
  const key = `${options.empty ? 'empty' : 'face'}|${options.label ?? ''}|${options.icon ?? ''}|${options.textColor}`;
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
