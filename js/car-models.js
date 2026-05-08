/* Procedural low-poly car archetypes. Each takes (color1, color2) and
 * returns a THREE.Group oriented with +Z = forward (drag-strip convention).
 * Shared helpers at the bottom.
 *
 * The archetype names match balance.cars[i].archetype.
 */

const ARCHETYPES = {};

ARCHETYPES.sedan = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.7, 0.9, 4.0),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.55; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.55, 0.95, 2.0),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.45, -0.05); g.add(cabin);
  addWheels(g, 0.36, 1.5, 1.2, 0.36, 1.5, 0.95);
  addBumpers(g, 1.7, 4.0, 0.55);
  return g;
};

ARCHETYPES.hatch = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.85, 0.8, 3.6),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.5; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.7, 0.85, 2.1),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.3, -0.2); g.add(cabin);
  for (const px of [-0.95, 0.95]) for (const pz of [-1.2, 1.2]) {
    const f = new T.Mesh(new T.BoxGeometry(0.18, 0.3, 0.85),
      new T.MeshLambertMaterial({ color: 0x1a1a1a }));
    f.position.set(px, 0.55, pz); g.add(f);
  }
  addWing(g, 1.3, 0.06, 0.32, 0.5, 1.2, -1.7, 0x111111);
  addWheels(g, 0.4, 1.55, 1.25, 0.4, 1.55, 0.95);
  return g;
};

ARCHETYPES.sport = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.85, 0.7, 4.6),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.45; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.7, 0.7, 2.4),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.05, -0.4); cabin.rotation.x = -0.05; g.add(cabin);
  const hoodRidge = new T.Mesh(
    new T.BoxGeometry(1.5, 0.06, 1.4),
    new T.MeshLambertMaterial({ color: color1 })
  ); hoodRidge.position.set(0, 0.83, 1.4); g.add(hoodRidge);
  addWing(g, 1.5, 0.06, 0.3, 0.5, 1.0, -2.15, 0x111111);
  addWheels(g, 0.4, 1.6, 1.7, 0.4, 1.6, 1.35);
  return g;
};

ARCHETYPES.muscle = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(1.95, 0.85, 4.9),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.55; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.75, 0.7, 1.9),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 1.3, -0.6); g.add(cabin);
  const scoop = new T.Mesh(
    new T.BoxGeometry(0.85, 0.25, 0.9),
    new T.MeshLambertMaterial({ color: 0x111111 })
  ); scoop.position.set(0, 1.12, 1.2); g.add(scoop);
  for (const sx of [-0.55, 0.55]) {
    const exh = new T.Mesh(
      new T.CylinderGeometry(0.09, 0.09, 0.3, 10),
      new T.MeshLambertMaterial({ color: 0x444444 })
    );
    exh.rotation.x = Math.PI / 2;
    exh.position.set(sx, 0.4, -2.6); g.add(exh);
  }
  addWheels(g, 0.46, 1.65, 1.8, 0.5, 1.7, 1.5);
  return g;
};

ARCHETYPES.supercar = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const body = new T.Mesh(
    new T.BoxGeometry(2.05, 0.55, 4.5),
    new T.MeshLambertMaterial({ color: color1 })
  ); body.position.y = 0.4; g.add(body);
  const cabin = new T.Mesh(
    new T.BoxGeometry(1.4, 0.5, 1.6),
    new T.MeshLambertMaterial({ color: color2 })
  ); cabin.position.set(0, 0.92, -0.2); cabin.rotation.x = -0.08; g.add(cabin);
  for (const sx of [-1.0, 1.0]) {
    const scoop = new T.Mesh(
      new T.BoxGeometry(0.18, 0.4, 1.2),
      new T.MeshLambertMaterial({ color: 0x111111 })
    );
    scoop.position.set(sx, 0.65, -0.7); g.add(scoop);
  }
  addWing(g, 2.0, 0.08, 0.45, 0.55, 1.05, -2.0, 0x111111);
  for (const sx of [-1.0, 1.0]) {
    const haunch = new T.Mesh(
      new T.BoxGeometry(0.25, 0.35, 1.5),
      new T.MeshLambertMaterial({ color: color1 })
    );
    haunch.position.set(sx, 0.55, -0.8); g.add(haunch);
  }
  addWheels(g, 0.42, 1.7, 1.7, 0.48, 1.85, 1.4);
  return g;
};

ARCHETYPES.topfuel = function (color1, color2) {
  const T = window.THREE;
  const g = new T.Group();
  const chassis = new T.Mesh(
    new T.BoxGeometry(0.35, 0.18, 7.0),
    new T.MeshLambertMaterial({ color: color1 })
  ); chassis.position.y = 0.42; g.add(chassis);
  const shroud = new T.Mesh(
    new T.BoxGeometry(1.2, 0.6, 1.8),
    new T.MeshLambertMaterial({ color: color1 })
  ); shroud.position.set(0, 0.55, -2.2); g.add(shroud);
  const bubble = new T.Mesh(
    new T.SphereGeometry(0.32, 12, 8),
    new T.MeshLambertMaterial({ color: color2 })
  ); bubble.position.set(0, 1.1, -1.4); g.add(bubble);
  const block = new T.Mesh(
    new T.BoxGeometry(0.65, 0.7, 0.95),
    new T.MeshLambertMaterial({ color: 0x222222 })
  ); block.position.set(0, 0.95, -0.3); g.add(block);
  const sc = new T.Mesh(
    new T.BoxGeometry(0.55, 0.4, 0.55),
    new T.MeshLambertMaterial({ color: 0x666666 })
  ); sc.position.set(0, 1.42, -0.2); g.add(sc);
  addWheelAt(g,  0.5, 0.2, 3.0, 0.22, 0.22, 0.2);
  addWheelAt(g, -0.5, 0.2, 3.0, 0.22, 0.22, 0.2);
  addWheelAt(g,  0.95, 0.55, -2.6, 0.6, 0.6, 0.6);
  addWheelAt(g, -0.95, 0.55, -2.6, 0.6, 0.6, 0.6);
  addWing(g, 1.6, 0.08, 0.45, 0.6, 1.55, -2.85, 0x111111);
  return g;
};

/** Build a car given an archetype name and two colors. */
export function buildCar(archetype, color1, color2) {
  const fn = ARCHETYPES[archetype];
  if (!fn) throw new Error('unknown archetype: ' + archetype);
  return fn(color1, color2);
}

// ---------- helpers ----------
function addWheels(g, frontR, frontX, frontZ, rearR, rearX, rearZ) {
  rearR = rearR || frontR; rearX = rearX || frontX; rearZ = rearZ || frontZ;
  addWheelAt(g,  frontX, frontR,  frontZ, frontR, frontR, 0.32);
  addWheelAt(g, -frontX, frontR,  frontZ, frontR, frontR, 0.32);
  addWheelAt(g,  rearX,  rearR,  -rearZ,  rearR,  rearR,  0.36);
  addWheelAt(g, -rearX,  rearR,  -rearZ,  rearR,  rearR,  0.36);
}
function addWheelAt(g, x, y, z, rTop, rBot, w) {
  const T = window.THREE;
  const wm = new T.MeshLambertMaterial({ color: 0x0a0a0a });
  const wheel = new T.Mesh(new T.CylinderGeometry(rTop, rBot, w, 16), wm);
  wheel.position.set(x, y, z); wheel.rotation.z = Math.PI / 2;
  g.add(wheel);
}
function addWing(g, w, h, d, postH, y, z, color) {
  const T = window.THREE;
  const mat = new T.MeshLambertMaterial({ color });
  const post1 = new T.Mesh(new T.BoxGeometry(0.06, postH, 0.06), mat);
  post1.position.set(-w * 0.4, y - postH * 0.5, z); g.add(post1);
  const post2 = post1.clone(); post2.position.x = w * 0.4; g.add(post2);
  const wing = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  wing.position.set(0, y, z); g.add(wing);
}
function addBumpers(g, w, l, y) {
  const T = window.THREE;
  const m = new T.MeshLambertMaterial({ color: 0x222222 });
  const front = new T.Mesh(new T.BoxGeometry(w * 0.95, 0.18, 0.18), m);
  front.position.set(0, y - 0.25, l * 0.5); g.add(front);
  const rear = front.clone(); rear.position.z = -l * 0.5; g.add(rear);
}

export const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);
