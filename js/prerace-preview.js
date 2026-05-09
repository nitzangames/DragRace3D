/**
 * 3D preview for the pre-race info screen. Both cars staged at the start
 * line with the christmas tree between them; camera slowly orbits the
 * tree to give a cinematic look at the matchup.
 *
 * Lifecycle mirrors paint-preview.js — singleton, cleanup before mount.
 */
import { ENV_PRESETS } from './env-presets.js';
import { buildCar } from './car-models.js';

let _state = null;

export function cleanupPreracePreview() {
  if (!_state) return;
  if (_state.rafId) cancelAnimationFrame(_state.rafId);
  if (_state.scene) {
    _state.scene.traverse((o) => {
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

export function mountPreracePreview(parent, raceBalance, envId) {
  cleanupPreracePreview();
  const T = window.THREE;
  const canvas = document.createElement('canvas');
  canvas.className = 'prerace-preview-canvas';
  canvas.width = 720; canvas.height = 320;
  parent.appendChild(canvas);

  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.width, canvas.height, false);

  const preset = ENV_PRESETS[envId] || ENV_PRESETS.day;
  const scene = new T.Scene();
  scene.background = new T.Color(preset.fog.color);
  scene.fog = new T.Fog(preset.fog.color, 25, 120);

  scene.add(new T.AmbientLight(preset.ambient, 0.55));
  scene.add(new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.4));
  const sun = new T.DirectionalLight(preset.sun, preset.lightIntensity);
  sun.position.set(8, 10, 6);
  scene.add(sun);

  // Strip patch (just enough for the staging area).
  const stripMat = new T.MeshLambertMaterial({ color: 0x2d2d31 });
  const strip = new T.Mesh(new T.PlaneGeometry(15, 60), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -15);
  scene.add(strip);
  // Lane stripe (yellow center line).
  const lineMat = new T.MeshBasicMaterial({ color: 0xd6b22f });
  const line = new T.Mesh(new T.PlaneGeometry(0.25, 60), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.01, -15);
  scene.add(line);
  // Ground beyond the strip.
  const dirtMat = new T.MeshLambertMaterial({ color: preset.ground });
  const dirt = new T.Mesh(new T.PlaneGeometry(120, 120), dirtMat);
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(0, -0.05, -10);
  scene.add(dirt);

  // Tiny christmas tree — focal point of the orbit.
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

  // Both cars staged at start. Player on +X (lane 0 = right), opponent on -X.
  const player = raceBalance.cars[0];
  const opponent = raceBalance.cars[1];
  const playerCar = buildCar(player.archetype, player.color1, player.color2, player.stripe || 'none');
  playerCar.position.set(2.5, 0, 2);
  scene.add(playerCar);
  const opponentCar = buildCar(opponent.archetype, opponent.color1, opponent.color2, opponent.stripe || 'none');
  opponentCar.position.set(-2.5, 0, 2);
  scene.add(opponentCar);

  const camera = new T.PerspectiveCamera(42, canvas.width / canvas.height, 0.1, 200);

  // Orbit around a point near the tree's base. Slow rotation so it reads
  // as cinematic rather than distracting.
  const center = { x: 0, y: 2.2, z: -1.5 };
  const radius = 10;
  const heightOffset = 3.5;
  let angle = 0.6; // start a few degrees past straight-on so cars aren't edge-on

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

  _state = { renderer, scene, rafId: null };
  _state.rafId = requestAnimationFrame(tick);

  return { dispose: cleanupPreracePreview };
}
