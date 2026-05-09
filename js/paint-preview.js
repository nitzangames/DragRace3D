/**
 * Live 3D preview of the player's car for the paint UI. Owns its own
 * THREE renderer + scene. Slowly rotates the car so colors are visible
 * from multiple angles.
 *
 * Lifecycle:
 *   - mountPaintPreview(parent, archetype, paint) creates everything and
 *     returns { update(paint), dispose() }.
 *   - cleanupPaintPreview() disposes the active preview (idempotent).
 *
 * Always call cleanupPaintPreview() before mounting a fresh one OR before
 * leaving the screen — leaving the rAF loop running on a detached canvas
 * leaks a WebGL context.
 */
import { buildCar } from './car-models.js';

let _state = null;

export function cleanupPaintPreview() {
  if (!_state) return;
  if (_state.rafId) cancelAnimationFrame(_state.rafId);
  // Dispose all geometries/materials on the holder before tearing down.
  if (_state.carHolder) {
    _state.carHolder.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
  if (_state.renderer) {
    try {
      _state.renderer.dispose();
      if (_state.renderer.forceContextLoss) _state.renderer.forceContextLoss();
    } catch (_) {}
  }
  _state = null;
}

export function mountPaintPreview(parent, archetype, paint) {
  cleanupPaintPreview();
  const T = window.THREE;
  const canvas = document.createElement('canvas');
  canvas.className = 'paint-preview-canvas';
  canvas.width = 600; canvas.height = 280;
  parent.appendChild(canvas);

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.width, canvas.height, false);

  const scene = new T.Scene();
  scene.add(new T.AmbientLight(0xb0b8d0, 0.55));
  scene.add(new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.4));
  const sun = new T.DirectionalLight(0xfff0d0, 0.95);
  sun.position.set(5, 8, 5);
  scene.add(sun);

  const camera = new T.PerspectiveCamera(35, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(7, 3, 7);
  camera.lookAt(0, 0.6, 0);

  const carHolder = new T.Group();
  scene.add(carHolder);

  function rebuild(p) {
    while (carHolder.children.length > 0) {
      const c = carHolder.children[0];
      carHolder.remove(c);
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    }
    const car = buildCar(archetype, p.primary, p.secondary, p.stripe || 'none');
    carHolder.add(car);
  }
  rebuild(paint);

  let angle = 0.4;
  function tick() {
    angle += 0.005;
    carHolder.rotation.y = angle;
    renderer.render(scene, camera);
    if (_state) _state.rafId = requestAnimationFrame(tick);
  }

  _state = { renderer, scene, carHolder, rebuild, rafId: null };
  _state.rafId = requestAnimationFrame(tick);

  return {
    update: rebuild,
    dispose: cleanupPaintPreview,
  };
}

/** Update the currently-mounted preview's paint without remounting (so the
 *  rotation angle isn't reset). No-op when no preview is active. */
export function updateActivePaintPreview(paint) {
  if (_state && _state.rebuild) _state.rebuild(paint);
}
