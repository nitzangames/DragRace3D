/* Builds the classic-strip environment as a THREE.Group + ancillary objects.
 * Reads window.THREE (loaded via CDN <script>). All other env builders are
 * deferred to Plan 3.
 */

export function buildClassicEnv(scene) {
  const T = window.THREE;

  scene.background = new T.Color(0x9bb8d8);
  scene.fog = new T.Fog(0x9bb8d8, 80, 400);

  scene.add(new T.AmbientLight(0xa8b8d8, 0.55));
  scene.add(new T.HemisphereLight(0xa8c8ff, 0x3a3020, 0.35));
  const sun = new T.DirectionalLight(0xfff0d0, 1.1);
  sun.position.set(60, 90, 40);
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

  const strip = new T.Mesh(
    new T.PlaneGeometry(15, 700),
    new T.MeshLambertMaterial({ map: stripTex })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0, -300);
  scene.add(strip);

  // Dirt run-off
  const dirt = new T.Mesh(
    new T.PlaneGeometry(300, 700),
    new T.MeshLambertMaterial({ color: 0x6a5a3c })
  );
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, -0.05, -300);
  scene.add(dirt);

  // Grandstands
  const standMat = new T.MeshLambertMaterial({ color: 0x556677 });
  for (let s = 0; s < 8; s++) {
    const stand = new T.Mesh(new T.BoxGeometry(15, 6, 4), standMat);
    stand.position.set(-14 + (s % 2) * 28, 3, -20 - s * 18);
    scene.add(stand);
  }

  // Christmas tree (returned for state-driven bulb updates)
  const tree = new T.Group();
  const post = new T.Mesh(
    new T.BoxGeometry(0.4, 6, 0.4),
    new T.MeshLambertMaterial({ color: 0x202020 })
  );
  post.position.y = 3; tree.add(post);
  const treeColors = [0x554000, 0x554000, 0x554000, 0x551100, 0x115522]; // dim defaults
  const ambers = []; let green = null;
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) {
      const bulb = new T.Mesh(
        new T.SphereGeometry(0.22, 12, 8),
        new T.MeshBasicMaterial({ color: treeColors[i] })
      );
      bulb.position.set(sx * 0.5, 5.5 - i * 0.9, 0);
      tree.add(bulb);
      if (i < 3) ambers.push(bulb);
      if (i === 4) green = bulb;
    }
  }
  tree.position.set(0, 0, -1.5);
  scene.add(tree);

  // Finish gantry
  const gantry = new T.Group();
  const left = new T.Mesh(
    new T.BoxGeometry(0.6, 9, 0.6),
    new T.MeshLambertMaterial({ color: 0x444444 })
  );
  left.position.set(-7.5, 4.5, 0); gantry.add(left);
  const right = left.clone(); right.position.x = 7.5; gantry.add(right);
  const cross = new T.Mesh(
    new T.BoxGeometry(15.6, 1.2, 0.6),
    new T.MeshLambertMaterial({ color: 0xc04020 })
  );
  cross.position.set(0, 9, 0); gantry.add(cross);
  // Finish line is 402.336m down strip (1/4 mile). Use that as Z.
  gantry.position.set(0, 0, -402.336);
  scene.add(gantry);

  return { strip, tree, ambers, green };
}

/** Update christmas tree bulb materials given current race state. */
export function updateTreeFromGameData(envObjects, gameData) {
  const amberOn  = 0xffaa00, amberOff = 0x554000;
  const greenOn  = 0x22ee48, greenOff = 0x115522;
  for (let i = 0; i < envObjects.ambers.length; i++) {
    const lit = (i < gameData.treeAmbersLit * 2);
    envObjects.ambers[i].material.color.setHex(lit ? amberOn : amberOff);
  }
  if (envObjects.green) {
    const greenLit = gameData.treeGreenAtS > 0;
    envObjects.green.material.color.setHex(greenLit ? greenOn : greenOff);
  }
}
