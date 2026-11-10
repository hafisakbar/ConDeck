/**
 * Kept in its own module so pages can check WebGL support without pulling the
 * three.js scene into the main bundle (the scene itself is lazy-loaded).
 */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
