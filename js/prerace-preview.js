/**
 * 3D preview for the pre-race info screen. Both cars staged at the start
 * line with the christmas tree between them; camera slowly orbits the
 * tree to give a cinematic look at the matchup.
 *
 * Lifecycle: when re-mounting onto the same parent, the renderer + canvas
 * are reused and only the scene contents (cars + env-coloured lights/fog)
 * are rebuilt. Mobile Safari has a hard per-process WebGL context cap and
 * forceContextLoss() is async, so a fresh renderer per visit was chewing
 * through contexts and OOM-killing the tab right at race-start.
 *
 * cleanupPreracePreview() fully tears everything down — call it when
 * leaving the screen on a path where the user won't return (rare, but
 * cheap insurance against rAF leaks on detached canvases).
 */
import { ENV_PRESETS } from './env-presets.js';
import { buildCar } from './car-models.js';

let _state = null;

function _disposeSceneContents(scene) {
  // Walk children in reverse so removal is safe; dispose geometry/material
  // for every mesh + its descendants, then strip the scene.
  for (let i = scene.children.length - 1; i >= 0; i--) {
    const c = scene.children[i];
    c.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    scene.remove(c);
  }
}

/** Pause the render loop without disposing the WebGL context. Use when
 *  navigating away from the prerace screen — keeps the context alive for
 *  the next visit (avoids the dispose / recreate context churn that was
 *  killing the tab on mobile Safari at race-start). */
export function pausePreracePreview() {
  if (!_state) return;
  if (_state.rafId) {
    cancelAnimationFrame(_state.rafId);
    _state.rafId = null;
  }
}

export function cleanupPreracePreview() {
  if (!_state) return;
  if (_state.rafId) cancelAnimationFrame(_state.rafId);
  if (_state.scene) _disposeSceneContents(_state.scene);
  if (_state.renderer) {
    try {
      _state.renderer.dispose();
      if (_state.renderer.forceContextLoss) _state.renderer.forceContextLoss();
    } catch (_) {}
  }
  _state = null;
}

function _populateScene(scene, raceBalance, envId) {
  const T = window.THREE;
  const preset = ENV_PRESETS[envId] || ENV_PRESETS.day;
  scene.background = new T.Color(preset.fog.color);
  scene.fog = new T.Fog(preset.fog.color, 25, 120);

  scene.add(new T.AmbientLight(preset.ambient, 0.55));
  scene.add(new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.4));
  const sun = new T.DirectionalLight(preset.sun, preset.lightIntensity);
  sun.position.set(8, 10, 6);
  scene.add(sun);

  const stripMat = new T.MeshLambertMaterial({ color: 0x2d2d31 });
  const strip = new T.Mesh(new T.PlaneGeometry(15, 60), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -15);
  scene.add(strip);
  const lineMat = new T.MeshBasicMaterial({ color: 0xd6b22f });
  const line = new T.Mesh(new T.PlaneGeometry(0.25, 60), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.01, -15);
  scene.add(line);
  const dirtMat = new T.MeshLambertMaterial({ color: preset.ground });
  const dirt = new T.Mesh(new T.PlaneGeometry(120, 120), dirtMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(0, -0.05, -10);
  scene.add(dirt);

  const tree = new T.Group();
  const post = new T.Mesh(
    new T.BoxGeometry(0.4, 6, 0.4),
    new T.MeshLambertMaterial({ color: 0x202020 })
  );
  post.position.y = 3; tree.add(post);
  const treeColors = [0x554000, 0x554000, 0x554000, 0x551100, 0x115522];
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.22, 12, 8),
        new T.MeshBasicMaterial({ color: treeColors[i] })
      );
      bulb.position.set(sx * 0.5, 5.5 - i * 0.9, 0);
      tree.add(bulb);
    }
  }
  tree.position.set(0, 0, -1.5);
  scene.add(tree);

  const player = raceBalance.cars[0];
  const opponent = raceBalance.cars[1];
  const playerCar = buildCar(player.archetype, player.color1, player.color2, player.stripe || 'none');
  playerCar.position.set(2.5, 0, 2);
  scene.add(playerCar);
  const opponentCar = buildCar(opponent.archetype, opponent.color1, opponent.color2, opponent.stripe || 'none');
  opponentCar.position.set(-2.5, 0, 2);
  scene.add(opponentCar);
}

export function mountPreracePreview(parent, raceBalance, envId) {
  const T = window.THREE;

  // Fast path: reuse the existing renderer + canvas + camera; swap scene
  // contents and restart the rAF loop if it was paused.
  if (_state && _state.parent === parent &&
      _state.canvas && _state.canvas.parentNode === parent) {
    _disposeSceneContents(_state.scene);
    _populateScene(_state.scene, raceBalance, envId);
    if (!_state.rafId && _state.tick) {
      _state.rafId = requestAnimationFrame(_state.tick);
    }
    return { dispose: cleanupPreracePreview };
  }

  cleanupPreracePreview();
  const canvas = document.createElement('canvas');
  canvas.className = 'prerace-preview-canvas';
  canvas.width = 720; canvas.height = 320;
  parent.appendChild(canvas);

  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.width, canvas.height, false);

  const scene = new T.Scene();
  _populateScene(scene, raceBalance, envId);

  const camera = new T.PerspectiveCamera(42, canvas.width / canvas.height, 0.1, 200);

  // Orbit around a point near the tree's base. Slow rotation so it reads
  // as cinematic rather than distracting.
  const center = { x: 0, y: 2.2, z: -1.5 };
  const radius = 10;
  const heightOffset = 3.5;
  let angle = 0.6;

  function tick() {
    angle += 0.004;
    camera.position.set(
      center.x + Math.sin(angle) * radius,
      center.y + heightOffset,
      center.z + Math.cos(angle) * radius
    );
    camera.lookAt(center.x, center.y, center.z);
    renderer.render(scene, camera);
    if (_state) _state.rafId = requestAnimationFrame(tick);
  }

  _state = { renderer, scene, parent, canvas, rafId: null, tick };
  _state.rafId = requestAnimationFrame(tick);

  return { dispose: cleanupPreracePreview };
}
