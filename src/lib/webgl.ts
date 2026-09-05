// One-time WebGL capability probe. Both 3D viewers call this before
// instantiating THREE.WebGLRenderer; if the browser can't create a context
// (blocked GPU, disabled acceleration, headless preview, etc.) we skip
// Three.js entirely and render a static fallback — preventing the
// "Error creating WebGL context." throw that crashed the Home tab.
let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    cached = !!gl;
  } catch {
    cached = false;
  }
  return cached;
}