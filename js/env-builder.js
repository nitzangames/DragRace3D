/* Builds the strip environment: lighting, shadow setup, asphalt + dirt,
 * christmas tree, finish gantry, and a `sceneryGroup` populated by the
 * matching js/scenery.js variant. applyEnvPreset rebuilds the scenery in
 * place when the active env id changes between races.
 *
 * Reads window.THREE (loaded via CDN <script>).
 */
import { ENV_PRESETS } from './env-presets.js';
import { pickScenery } from './scenery.js';

const FALLBACK_PRESET_ID = 'amphitheater';

export function buildClassicEnv(scene, presetId) {
  const T = window.THREE;
  const id = ENV_PRESETS[presetId] ? presetId : FALLBACK_PRESET_ID;
  const initial = ENV_PRESETS[id];

  scene.background = new T.Color(initial.fog.color);
  scene.fog = new T.Fog(initial.fog.color, initial.fog.near, initial.fog.far);

  const ambient = new T.AmbientLight(initial.ambient, 0.55);
  scene.add(ambient);
  const hemi = new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.35);
  scene.add(hemi);
  const sun = new T.DirectionalLight(initial.sun, initial.lightIntensity);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  // 512² shadow map (was 1024²) — quarters the GPU memory cost
  // (~1MB instead of ~4MB) and is plenty for a chase-camera car shadow.
  // Matters on mobile Safari where the tab gets OOM-killed if total
  // GPU usage drifts above ~256MB.
  sun.shadow.mapSize.width = 512;
  sun.shadow.mapSize.height = 512;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 60;
  sun.shadow.camera.bottom = -60;
  sun.shadow.bias = -0.0005;
  sun.target.position.set(0, 0, -50);
  scene.add(sun.target);
  scene.add(sun);

  // Asphalt strip texture (canvas, repeated)
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = 256; stripCanvas.height = 1024;
  const sc = stripCanvas.getContext('2d');
  sc.fillStyle = '#2d2d31'; sc.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 1500; i++) {
    sc.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.06).toFixed(3) + ')';
    sc.fillRect(Math.random() * 256, Math.random() * 1024, 2, 2);
  }
  sc.fillStyle = '#d6b22f'; sc.fillRect(126, 0, 4, 1024);
  sc.fillStyle = '#dddddd'; sc.fillRect(8, 0, 4, 1024); sc.fillRect(244, 0, 4, 1024);
  const stripTex = new T.CanvasTexture(stripCanvas);
  stripTex.wrapS = T.RepeatWrapping; stripTex.wrapT = T.RepeatWrapping;
  stripTex.repeat.set(1, 60); stripTex.anisotropy = 4;

  const stripMat = new T.MeshLambertMaterial({ map: stripTex });
  const strip = new T.Mesh(new T.PlaneGeometry(15, 700), stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -300);
  strip.receiveShadow = true;
  scene.add(strip);

  const dirtMat = new T.MeshLambertMaterial({ color: initial.ground });
  const dirt = new T.Mesh(new T.PlaneGeometry(300, 700), dirtMat);
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, -0.05, -300);
  dirt.receiveShadow = true;
  scene.add(dirt);

  // Christmas tree (returned for state-driven bulb updates)
  const tree = new T.Group();
  const post = new T.Mesh(
    new T.BoxGeometry(0.4, 6, 0.4),
    new T.MeshLambertMaterial({ color: 0x202020 })
  );
  post.position.y = 3; tree.add(post);
  const treeColors = [0x554000, 0x554000, 0x554000, 0x551100, 0x115522];
  const ambers = []; const greens = [];
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.22, 12, 8),
        new T.MeshBasicMaterial({ color: treeColors[i] })
      );
      bulb.position.set(sx * 0.5, 5.5 - i * 0.9, 0);
      tree.add(bulb);
      if (i < 3) ambers.push(bulb);
      if (i === 4) greens.push(bulb);
    }
  }
  tree.position.set(0, 0, -1.5);
  scene.add(tree);

  // Finish gantry
  const gantry = new T.Group();
  const left = new T.Mesh(new T.BoxGeometry(0.6, 9, 0.6),
    new T.MeshLambertMaterial({ color: 0x444444 }));
  left.position.set(-7.5, 4.5, 0); gantry.add(left);
  const right = left.clone(); right.position.x = 7.5; gantry.add(right);
  const cross = new T.Mesh(new T.BoxGeometry(15.6, 1.2, 0.6),
    new T.MeshLambertMaterial({ color: 0xc04020 }));
  cross.position.set(0, 9, 0); gantry.add(cross);
  gantry.position.set(0, 0, -402.336);
  scene.add(gantry);

  // Variant-specific scenery (grandstands / warehouses / palms / neon /
  // depending on presetId). Living in its own sub-group so applyEnvPreset
  // can rebuild it without touching strip / lights / tree.
  const sceneryGroup = new T.Group();
  scene.add(sceneryGroup);
  // pickScenery may return an optional tick(dt) for animated variants
  // (e.g. industrial chimney smoke). null for fully static sceneries.
  const sceneryTick = pickScenery(sceneryGroup, id);

  return { strip, tree, ambers, greens, ambient, sun, dirtMat, scene, sceneryGroup, sceneryTick };
}

/**
 * Mutate scene/lights/materials AND rebuild scenery to match a preset.
 * Caller provides envObjects returned from buildClassicEnv. No reallocation
 * of the strip/tree/lights — only the scenery sub-group is wiped + rebuilt.
 */
export function applyEnvPreset(envObjects, presetId) {
  const T = window.THREE;
  const id = ENV_PRESETS[presetId] ? presetId : FALLBACK_PRESET_ID;
  const p = ENV_PRESETS[id];
  if (envObjects.scene) {
    envObjects.scene.background = new T.Color(p.fog.color);
    envObjects.scene.fog = new T.Fog(p.fog.color, p.fog.near, p.fog.far);
  }
  if (envObjects.ambient) envObjects.ambient.color.setHex(p.ambient);
  if (envObjects.sun) {
    envObjects.sun.color.setHex(p.sun);
    envObjects.sun.intensity = p.lightIntensity;
  }
  if (envObjects.dirtMat) envObjects.dirtMat.color.setHex(p.ground);
  if (envObjects.sceneryGroup) {
    // Tear down old scenery (geometries + materials) before rebuilding.
    const g = envObjects.sceneryGroup;
    while (g.children.length > 0) {
      const c = g.children[0];
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      g.remove(c);
    }
    envObjects.sceneryTick = pickScenery(g, id);
  }
}

/** Update christmas tree bulb materials given current race state. */
export function updateTreeFromGameData(envObjects, gameData) {
  const amberOn  = 0xffaa00, amberOff = 0x554000;
  const greenOn  = 0x22ee48, greenOff = 0x115522;
  for (let i = 0; i < envObjects.ambers.length; i++) {
    const lit = (i < gameData.treeAmbersLit * 2);
    envObjects.ambers[i].material.color.setHex(lit ? amberOn : amberOff);
  }
  const greenLit = gameData.treeGreenAtS > 0;
  for (const bulb of envObjects.greens || []) {
    bulb.material.color.setHex(greenLit ? greenOn : greenOff);
  }
}
