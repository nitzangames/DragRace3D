/**
 * Track scenery — one builder per ENV_PRESET_IDS entry. Each function adds
 * its meshes to the supplied parent group (env-builder owns the parent's
 * lifecycle so swapping envs only rebuilds the scenery sub-group, not the
 * strip / lights / shadow setup).
 *
 * All builders follow the same shape:
 *   buildXxx(parent, T)
 *     parent: a THREE.Group already added to the scene
 *     T:      window.THREE namespace
 *
 * Builders adapted from mockups/track-scenery/{stands,urban,desert,night}.html.
 */

const CROWD_HEX = [0xff5040, 0x4060ff, 0xffd14a, 0x40c060, 0xeeeeee, 0xc040c0];

function crowdMats(T) {
  return CROWD_HEX.map((c) => new T.MeshLambertMaterial({ color: c }));
}

function crowdAt(T, parent, x, y, z, mats) {
  const m = mats[Math.floor(Math.random() * mats.length)];
  const c = new T.Mesh(new T.BoxGeometry(0.55, 0.6, 0.45), m);
  c.position.set(x, y, z);
  c.castShadow = true;
  parent.add(c);
}

// ===========================================================================
// STADIUM · A · AMPHITHEATER — stepped concrete risers + back wall + flags
// ===========================================================================
export function buildAmphitheater(parent, T) {
  const concreteMat = new T.MeshLambertMaterial({ color: 0x9a9a96 });
  const stepLight   = new T.MeshLambertMaterial({ color: 0xb0b0ac });
  const stepDark    = new T.MeshLambertMaterial({ color: 0x8a8a86 });
  const treadMat    = new T.MeshLambertMaterial({ color: 0xc0c0bc });
  const cMats = crowdMats(T);

  for (const side of [-1, 1]) {
    const startZ = -10, endZ = -300;
    const length = Math.abs(endZ - startZ);
    const midZ = (startZ + endZ) / 2;
    const stepHeight = 1.0, stepDepth = 1.2;
    for (let row = 0; row < 8; row++) {
      const rowY = stepHeight * row;
      const rowX = side * (18 + row * stepDepth);
      const riser = new T.Mesh(
        new T.BoxGeometry(0.4, stepHeight, length),
        row % 2 === 0 ? stepLight : stepDark,
      );
      riser.position.set(rowX, rowY + stepHeight / 2, midZ);
      riser.castShadow = true;
      parent.add(riser);
      const tread = new T.Mesh(new T.BoxGeometry(stepDepth, 0.18, length), treadMat);
      tread.position.set(rowX + side * stepDepth / 2, rowY + stepHeight, midZ);
      tread.castShadow = true;
      parent.add(tread);
      for (let cz = startZ - 1; cz >= endZ + 1; cz -= 1.0) {
        if (Math.random() < 0.85) {
          crowdAt(T, parent,
            rowX + side * stepDepth / 2,
            rowY + stepHeight + 0.3, cz, cMats);
        }
      }
    }
    const back = new T.Mesh(new T.BoxGeometry(1.5, 11, length), concreteMat);
    back.position.set(side * (18 + 8 * stepDepth + 0.8), 5.5, midZ);
    back.castShadow = true;
    parent.add(back);
    for (let z = startZ - 5; z >= endZ; z -= 50) {
      const stair = new T.Mesh(new T.BoxGeometry(8, 0.1, 4),
        new T.MeshLambertMaterial({ color: 0x404040 }));
      stair.position.set(side * 22, 0.05, z);
      parent.add(stair);
    }
  }

  // Top-rim flag poles + cross-arm + flag (each set forms one connected unit)
  const poleMat = new T.MeshLambertMaterial({ color: 0x303030 });
  for (let z = -20; z >= -290; z -= 30) {
    for (const side of [-1, 1]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.2, 5, 0.2), poleMat);
      pole.position.set(side * 30, 11, z);
      parent.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(2.2, 0.12, 0.12), poleMat);
      arm.position.set(side * 31.1, 13.4, z);
      parent.add(arm);
      const flag = new T.Mesh(new T.PlaneGeometry(2, 1.2),
        new T.MeshLambertMaterial({
          color: side > 0 ? 0xc83a26 : 0x2a8fd4, side: T.DoubleSide,
        }));
      flag.position.set(side * 31.1, 12.7, z);
      parent.add(flag);
    }
  }
}

// ===========================================================================
// STADIUM · D · STEEL BLEACHERS — open framework, planks, floodlight pylons
// ===========================================================================
export function buildBleachers(parent, T) {
  const frameMat = new T.MeshLambertMaterial({ color: 0x6a6a6a });
  const plankMat = new T.MeshLambertMaterial({ color: 0x8a6a3a });
  const railMat  = new T.MeshLambertMaterial({ color: 0x404040 });
  const cMats = crowdMats(T);

  function makeBleacher() {
    const b = new T.Group();
    // Back columns only — the front edge of the bleacher is unsupported
    // (cantilevered over the planks) so the strip-facing side reads clean
    // without a row of poles in front of the spectators.
    for (const cdx of [-7, -3.5, 0, 3.5, 7]) {
      const col = new T.Mesh(new T.BoxGeometry(0.25, 8, 0.25), frameMat);
      col.position.set(cdx, 4, 2);
      col.castShadow = true;
      b.add(col);
    }
    // Single diagonal from front-bottom to back-top (no full X). With the
    // front poles removed, the back-to-front-top brace had nothing to
    // anchor against, so it's gone too.
    for (const cdx of [-7, 7]) {
      const d1 = new T.Mesh(new T.BoxGeometry(0.18, 9, 0.18), frameMat);
      d1.position.set(cdx, 4, 0); d1.rotation.x = Math.PI / 4;
      b.add(d1);
    }
    for (let row = 0; row < 5; row++) {
      const plank = new T.Mesh(new T.BoxGeometry(15, 0.25, 1.0), plankMat);
      plank.position.set(0, 1.3 + row * 1.3, -1.6 + row * 0.8);
      plank.castShadow = true;
      b.add(plank);
      for (let cx = -3; cx <= 3; cx += 0.9) {
        if (Math.random() < 0.7)
          crowdAt(T, b, cx, 1.7 + row * 1.3, -1.6 + row * 0.8, cMats);
      }
    }
    const rail = new T.Mesh(new T.BoxGeometry(15, 0.1, 0.1), railMat);
    rail.position.set(0, 1.5, -2.4); b.add(rail);
    const topRail = new T.Mesh(new T.BoxGeometry(15, 0.1, 0.1), railMat);
    topRail.position.set(0, 8, 2); b.add(topRail);
    return b;
  }
  for (let s = 0; s < 14; s++) {
    const side = (s % 2 === 0) ? -1 : 1;
    const sx = side * 16;
    const sz = -20 - s * 18;
    const block = makeBleacher();
    block.position.set(sx, 0, sz);
    block.rotation.y = side * Math.PI / 2;
    parent.add(block);
  }

  // Tall floodlight pylons
  for (let z = -40; z >= -260; z -= 60) {
    for (const side of [-1, 1]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.5, 16, 0.5), frameMat);
      pole.position.set(side * 28, 8, z);
      pole.castShadow = true;
      parent.add(pole);
      for (let f = 0; f < 4; f++) {
        const ang = (f / 4) * Math.PI * 2;
        const flood = new T.Mesh(new T.SphereGeometry(0.5, 12, 8),
          new T.MeshBasicMaterial({ color: 0xfffae0 }));
        flood.position.set(side * 28 + Math.cos(ang) * 0.7,
                           16, z + Math.sin(ang) * 0.7);
        parent.add(flood);
      }
    }
  }
}

// ===========================================================================
// URBAN · A · INDUSTRIAL — warehouses, billboards, smokestacks, jersey walls
// ===========================================================================
export function buildIndustrial(parent, T) {
  const warehouseMats = [
    new T.MeshLambertMaterial({ color: 0x4a4540 }),
    new T.MeshLambertMaterial({ color: 0x6a5a3a }),
    new T.MeshLambertMaterial({ color: 0x3a3a40 }),
    new T.MeshLambertMaterial({ color: 0x5a4a3a }),
  ];
  for (let s = 0; s < 14; s++) {
    const sx = (s % 2 === 0 ? -1 : 1) * (28 + (s % 4) * 6);
    const sz = -15 - s * 28;
    const w = 18 + (s % 3) * 6;
    const h = 8 + (s % 4) * 3;
    const d = 14;
    const mat = warehouseMats[s % 4];
    const wh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    wh.position.set(sx, h/2, sz);
    wh.castShadow = true;
    parent.add(wh);
    const roof = new T.Mesh(new T.BoxGeometry(w, 0.4, d),
      new T.MeshLambertMaterial({ color: 0x222222 }));
    roof.position.set(sx, h + 0.2, sz);
    parent.add(roof);
    const door = new T.Mesh(new T.BoxGeometry(0.05, 4, 4),
      new T.MeshLambertMaterial({ color: 0x6a4030 }));
    door.position.set(sx + (sx > 0 ? -w/2 - 0.025 : w/2 + 0.025), 2, sz);
    parent.add(door);
  }

  const billboardColors = [0xff5040, 0xffd14a, 0x4060ff, 0xffffff];
  const postMat = new T.MeshLambertMaterial({ color: 0x202020 });
  for (let i = 0; i < 5; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * 35;
    const z = -50 - i * 60;
    const sign = new T.Group();
    const post1 = new T.Mesh(new T.BoxGeometry(0.4, 8, 0.4), postMat);
    post1.position.set(-3, 4, 0); sign.add(post1);
    const post2 = new T.Mesh(new T.BoxGeometry(0.4, 8, 0.4), postMat);
    post2.position.set(3, 4, 0); sign.add(post2);
    const bb = new T.Mesh(new T.BoxGeometry(8, 4, 0.3),
      new T.MeshLambertMaterial({ color: billboardColors[i % 4] }));
    bb.position.set(0, 9, 0); sign.add(bb);
    sign.position.set(x, 0, z);
    sign.rotation.y = x > 0 ? -Math.PI/8 : Math.PI/8;
    parent.add(sign);
  }

  for (let i = 0; i < 4; i++) {
    const x = -90 + i * 60;
    const stack = new T.Mesh(new T.CylinderGeometry(2, 2.5, 28, 12),
      new T.MeshLambertMaterial({ color: 0x6a4a3a }));
    stack.position.set(x, 14, -340);
    stack.castShadow = true;
    parent.add(stack);
    const smoke = new T.Mesh(new T.SphereGeometry(4, 8, 6),
      new T.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.4 }));
    smoke.position.set(x + 2, 32, -340); parent.add(smoke);
  }

  for (let z = -10; z >= -340; z -= 5) {
    for (const bx of [-9, 9]) {
      const j = new T.Mesh(new T.BoxGeometry(0.8, 1.2, 4),
        new T.MeshLambertMaterial({ color: 0x9a9a96 }));
      j.position.set(bx, 0.6, z); parent.add(j);
    }
  }

  const overpass = new T.Mesh(new T.BoxGeometry(140, 4, 8),
    new T.MeshLambertMaterial({ color: 0x4a4a52 }));
  overpass.position.set(0, 18, -360); parent.add(overpass);
  for (let px = -50; px <= 50; px += 25) {
    const pier = new T.Mesh(new T.BoxGeometry(4, 18, 8),
      new T.MeshLambertMaterial({ color: 0x4a4a52 }));
    pier.position.set(px, 9, -360); parent.add(pier);
  }
}

// ===========================================================================
// URBAN · B · JUNKYARD — fences, junker stacks, containers, oil drums
// ===========================================================================
export function buildJunkyard(parent, T) {
  const fencePoleMat = new T.MeshLambertMaterial({ color: 0x404040 });
  const wireMat = new T.MeshBasicMaterial({ color: 0x8a8a8a });
  for (let z = -10; z >= -360; z -= 4) {
    for (const fx of [-13, 13]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.15, 3, 0.15), fencePoleMat);
      pole.position.set(fx, 1.5, z); parent.add(pole);
    }
  }
  for (const fx of [-13, 13]) {
    const top = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 350), fencePoleMat);
    top.position.set(fx, 2.9, -185); parent.add(top);
    const bot = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 350), fencePoleMat);
    bot.position.set(fx, 0.4, -185); parent.add(bot);
    for (let z = -10; z >= -360; z -= 0.6) {
      const wire = new T.Mesh(new T.BoxGeometry(0.04, 2.4, 0.04), wireMat);
      wire.position.set(fx, 1.6, z);
      wire.rotation.x = (z % 1.2 < 0.6) ? 0.6 : -0.6;
      parent.add(wire);
    }
  }

  const carBodyColors = [0xc83a26, 0x6a4a30, 0x4d6dd6, 0xffd14a, 0x33dd55,
                         0x6a6a6a, 0x804040, 0x405580];
  const junkSpots = [
    [-22, -30], [25, -50], [-26, -75], [22, -110], [-30, -140],
    [28, -170], [-24, -200], [26, -230], [-28, -260], [24, -290],
    [-32, -330], [30, -360],
  ];
  for (const [bx, bz] of junkSpots) {
    const stackHeight = 2 + Math.floor(Math.random() * 2);
    for (let st = 0; st < stackHeight; st++) {
      const c = carBodyColors[Math.floor(Math.random() * carBodyColors.length)];
      const body = new T.Mesh(new T.BoxGeometry(4, 1.2, 1.7),
        new T.MeshLambertMaterial({ color: c }));
      body.position.set(bx + (st * 0.3 - 0.4), 0.6 + st * 1.4, bz + (st * 0.2 - 0.3));
      body.rotation.y = (Math.random() - 0.5) * 0.4;
      body.rotation.z = (Math.random() - 0.5) * 0.15;
      body.castShadow = true;
      parent.add(body);
      const cabin = new T.Mesh(new T.BoxGeometry(2, 0.7, 1.55),
        new T.MeshLambertMaterial({ color: 0x222222 }));
      cabin.position.set(bx + (st * 0.3 - 0.4), 1.55 + st * 1.4, bz + (st * 0.2 - 0.3));
      cabin.rotation.copy(body.rotation);
      parent.add(cabin);
    }
  }

  const containerColors = [0xc83a26, 0x2a8fd4, 0xff7f00, 0x33aa55, 0x806030];
  const containerSpots = [
    [-32, -90], [34, -130], [-36, -180], [32, -250], [-34, -310],
  ];
  for (const [cxp, czp] of containerSpots) {
    for (let st = 0; st < 2 + Math.floor(Math.random() * 2); st++) {
      const c = containerColors[Math.floor(Math.random() * containerColors.length)];
      const cont = new T.Mesh(new T.BoxGeometry(6, 2.6, 2.5),
        new T.MeshLambertMaterial({ color: c }));
      cont.position.set(cxp + (st * 0.4 - 0.6), 1.3 + st * 2.7, czp);
      cont.rotation.y = (Math.random() - 0.5) * 0.3;
      cont.castShadow = true;
      parent.add(cont);
      const stripe = new T.Mesh(new T.BoxGeometry(6.05, 0.1, 2.55),
        new T.MeshLambertMaterial({ color: 0x222222 }));
      stripe.position.copy(cont.position);
      stripe.rotation.copy(cont.rotation);
      parent.add(stripe);
    }
  }

  const drumMat = new T.MeshLambertMaterial({ color: 0x4a3020 });
  for (let i = 0; i < 30; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 8);
    const z = -20 - Math.random() * 320;
    const drum = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 1.0, 12), drumMat);
    drum.position.set(x, 0.5, z);
    drum.rotation.z = (Math.random() < 0.15) ? Math.PI/2 : 0;
    parent.add(drum);
  }

  const palletMat = new T.MeshLambertMaterial({ color: 0x8a6a3a });
  for (const [pxp, pzp] of [[-20, -55], [22, -100], [-22, -160], [24, -220]]) {
    for (let st = 0; st < 4; st++) {
      const p = new T.Mesh(new T.BoxGeometry(1.2, 0.18, 1.0), palletMat);
      p.position.set(pxp, 0.1 + st * 0.18, pzp);
      parent.add(p);
    }
  }
}

// ===========================================================================
// URBAN · C · SKYLINE — tall buildings rotated 90°, lit windows, neon signs
// ===========================================================================
export function buildSkyline(parent, T) {
  const buildingMats = [
    new T.MeshLambertMaterial({ color: 0x3a4250 }),
    new T.MeshLambertMaterial({ color: 0x4a5260 }),
    new T.MeshLambertMaterial({ color: 0x2a3240 }),
    new T.MeshLambertMaterial({ color: 0x5a4a3a }),
    new T.MeshLambertMaterial({ color: 0x303a48 }),
  ];
  const winMat = new T.MeshBasicMaterial({ color: 0xffe080 });
  const winGeo = new T.BoxGeometry(0.7, 0.6, 0.05);

  for (let s = 0; s < 16; s++) {
    const sx = (s % 2 === 0 ? -1 : 1) * (24 + (s % 3) * 4);
    const sz = -15 - s * 22;
    const w = 14 + (s % 3) * 4;
    const h = 22 + (s % 5) * 8;
    const d = 14;
    const mat = buildingMats[s % buildingMats.length];

    const bldg = new T.Group();
    const box = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    box.position.y = h / 2;
    box.castShadow = true;
    bldg.add(box);

    const winFaceZ = sx > 0 ? -d/2 - 0.05 : d/2 + 0.05;
    const rows = Math.floor(h / 2.5) - 1;
    const cols = Math.floor(w / 2) - 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.5) {
          const win = new T.Mesh(winGeo, winMat);
          win.position.set(-w/2 + 1.2 + c * 1.9, 1.2 + r * 2.4, winFaceZ);
          bldg.add(win);
        }
      }
    }

    const rooftop = new T.Mesh(new T.BoxGeometry(2, 1, 2),
      new T.MeshLambertMaterial({ color: 0x6a6a6a }));
    rooftop.position.set(s % 2 ? 2 : -2, h + 0.5, 2); bldg.add(rooftop);
    if (s % 3 === 0) {
      const antenna = new T.Mesh(new T.BoxGeometry(0.15, 4, 0.15),
        new T.MeshLambertMaterial({ color: 0x303030 }));
      antenna.position.set(0, h + 2, -2); bldg.add(antenna);
    }
    bldg.position.set(sx, 0, sz);
    bldg.rotation.y = Math.PI / 2;
    parent.add(bldg);
  }

  const neonColors = [0xff20a0, 0x40ffff, 0xffff40, 0xff8040, 0x80ff40];
  for (let i = 0; i < 5; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (24 + (i % 3) * 4);
    const z = -30 - i * 70;
    const sign = new T.Mesh(new T.BoxGeometry(0.3, 12, 2.5),
      new T.MeshBasicMaterial({ color: neonColors[i] }));
    sign.position.set(x + (x > 0 ? -7 : 7), 16, z + 7);
    parent.add(sign);
  }

  for (let z = -25; z >= -340; z -= 30) {
    for (const px of [-18, 18]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.3, 9, 0.3),
        new T.MeshLambertMaterial({ color: 0x202020 }));
      pole.position.set(px, 4.5, z); parent.add(pole);
      const arm = new T.Mesh(new T.BoxGeometry(0.15, 0.15, 1.4),
        new T.MeshLambertMaterial({ color: 0x202020 }));
      arm.position.set(px + (px > 0 ? -0.6 : 0.6), 8.8, z); parent.add(arm);
      const bulb = new T.Mesh(new T.SphereGeometry(0.4, 12, 8),
        new T.MeshBasicMaterial({ color: 0xffd980 }));
      bulb.position.set(px + (px > 0 ? -1.2 : 1.2), 8.8, z); parent.add(bulb);
    }
  }

  const skylineMat = new T.MeshLambertMaterial({ color: 0x1a2230 });
  for (let i = 0; i < 14; i++) {
    const x = -130 + i * 20;
    const h = 38 + (i % 5) * 12;
    const sky = new T.Mesh(new T.BoxGeometry(20, h, 12), skylineMat);
    sky.position.set(x, h/2, -390); parent.add(sky);
  }
}

// ===========================================================================
// URBAN · D · HIGHWAY — twin elevated freeways, overpass, road signs, gas
// ===========================================================================
export function buildHighway(parent, T) {
  const freewayMat = new T.MeshLambertMaterial({ color: 0x303034 });
  const lineMat = new T.MeshBasicMaterial({ color: 0xffe040 });
  const guardMat = new T.MeshLambertMaterial({ color: 0x8a8a86 });
  for (const side of [-1, 1]) {
    const freeway = new T.Mesh(new T.BoxGeometry(10, 0.4, 350), freewayMat);
    freeway.position.set(side * 30, 5, -185);
    freeway.castShadow = true;
    parent.add(freeway);
    const line = new T.Mesh(new T.BoxGeometry(0.2, 0.05, 350), lineMat);
    line.position.set(side * 30, 5.25, -185); parent.add(line);
    for (const railOff of [-4.7, 4.7]) {
      const guard = new T.Mesh(new T.BoxGeometry(0.6, 1.2, 350), guardMat);
      guard.position.set(side * 30 + railOff, 5.6, -185); parent.add(guard);
    }
    for (let pz = -20; pz >= -350; pz -= 30) {
      const pillar = new T.Mesh(new T.BoxGeometry(2.5, 5, 2.5), guardMat);
      pillar.position.set(side * 30, 2.5, pz);
      pillar.castShadow = true;
      parent.add(pillar);
    }
  }

  const overpass = new T.Mesh(new T.BoxGeometry(80, 1.5, 12),
    new T.MeshLambertMaterial({ color: 0x404048 }));
  overpass.position.set(0, 14, -180); parent.add(overpass);
  for (const px of [-25, -5, 15, 35]) {
    const pier = new T.Mesh(new T.BoxGeometry(4, 14, 5),
      new T.MeshLambertMaterial({ color: 0x4a4a52 }));
    pier.position.set(px - 2, 7, -180); parent.add(pier);
  }
  for (const ry of [13.5, 14.5]) {
    const rail = new T.Mesh(new T.BoxGeometry(80, 0.2, 0.2),
      new T.MeshLambertMaterial({ color: 0x303030 }));
    rail.position.set(0, ry, -174); parent.add(rail);
    const rail2 = rail.clone(); rail2.position.z = -186; parent.add(rail2);
  }

  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * 40;
    const z = -50 - i * 80;
    for (const off of [-5, 5]) {
      const post = new T.Mesh(new T.BoxGeometry(0.5, 14, 0.5),
        new T.MeshLambertMaterial({ color: 0x404040 }));
      post.position.set(x + off, 7, z); parent.add(post);
    }
    const sign = new T.Mesh(new T.BoxGeometry(12, 4, 0.4),
      new T.MeshLambertMaterial({ color: 0x1a6a3a }));
    sign.position.set(x, 13, z); parent.add(sign);
    const border = new T.Mesh(new T.BoxGeometry(12.4, 4.4, 0.3),
      new T.MeshLambertMaterial({ color: 0xeeeeee }));
    border.position.set(x, 13, z - 0.05); parent.add(border);
    for (let bi = 0; bi < 5; bi++) {
      const ltr = new T.Mesh(new T.BoxGeometry(0.7, 1.8, 0.05),
        new T.MeshBasicMaterial({ color: 0xeeeeee }));
      ltr.position.set(x - 4 + bi * 1.6, 13, z + 0.21); parent.add(ltr);
    }
  }

  // Gas station rotated 90° so the sign face turns toward the strip
  const gasX = -18, gasZ = -110;
  const gas = new T.Group();
  const canopy = new T.Mesh(new T.BoxGeometry(14, 0.6, 14),
    new T.MeshLambertMaterial({ color: 0xeeeeee }));
  canopy.position.set(0, 5, 0); gas.add(canopy);
  for (const cdx of [-6, 6]) for (const cdz of [-6, 6]) {
    const col = new T.Mesh(new T.BoxGeometry(0.5, 5, 0.5),
      new T.MeshLambertMaterial({ color: 0xc0c0bc }));
    col.position.set(cdx, 2.5, cdz); gas.add(col);
  }
  for (const pdx of [-3, 3]) for (const pdz of [-3, 3]) {
    const pump = new T.Mesh(new T.BoxGeometry(1, 1.6, 0.6),
      new T.MeshLambertMaterial({ color: 0xc83a26 }));
    pump.position.set(pdx, 0.8, pdz); gas.add(pump);
  }
  const towerPole = new T.Mesh(new T.BoxGeometry(0.4, 14, 0.4),
    new T.MeshLambertMaterial({ color: 0x404040 }));
  towerPole.position.set(-9, 7, 0); gas.add(towerPole);
  const signFace = new T.Mesh(new T.BoxGeometry(4, 3, 0.3),
    new T.MeshLambertMaterial({ color: 0xffd14a }));
  signFace.position.set(-9, 13, 0); gas.add(signFace);
  const signLogo = new T.Mesh(new T.BoxGeometry(2, 1.5, 0.1),
    new T.MeshBasicMaterial({ color: 0xc83a26 }));
  signLogo.position.set(-9, 13, 0.21); gas.add(signLogo);
  gas.position.set(gasX, 0, gasZ);
  gas.rotation.y = Math.PI / 2;
  parent.add(gas);

  const skyMat = new T.MeshLambertMaterial({ color: 0x4a4a52 });
  for (let i = 0; i < 10; i++) {
    const x = -110 + i * 24;
    const h = 24 + (i % 4) * 10;
    const b = new T.Mesh(new T.BoxGeometry(22, h, 14), skyMat);
    b.position.set(x, h/2, -380); parent.add(b);
  }
}

// ===========================================================================
// DESERT · C · RED ROCK — towering stepped mesas, spires, canyon wall, brush
// ===========================================================================
export function buildRedRock(parent, T) {
  const redMat = new T.MeshLambertMaterial({ color: 0xb44020 });
  const redDarkMat = new T.MeshLambertMaterial({ color: 0x8a3018 });
  const redLightMat = new T.MeshLambertMaterial({ color: 0xc85040 });

  const buttePositions = [
    [-32, -40, 18, 32, redMat],
    [34, -80, 22, 28, redDarkMat],
    [-38, -120, 16, 36, redLightMat],
    [40, -160, 26, 30, redMat],
    [-34, -200, 20, 34, redDarkMat],
    [42, -250, 24, 38, redLightMat],
    [-40, -290, 18, 32, redMat],
    [38, -340, 22, 28, redDarkMat],
  ];
  for (const [x, z, w, h, mat] of buttePositions) {
    const lay1 = new T.Mesh(new T.BoxGeometry(w, h * 0.65, w * 0.9), mat);
    lay1.position.set(x, h * 0.65 / 2, z);
    lay1.castShadow = true;
    parent.add(lay1);
    const lay2 = new T.Mesh(new T.BoxGeometry(w * 0.85, h * 0.25, w * 0.75),
      mat === redDarkMat ? redMat : redDarkMat);
    lay2.position.set(x, h * 0.65 + h * 0.25 / 2, z);
    lay2.castShadow = true;
    parent.add(lay2);
    const lay3 = new T.Mesh(new T.BoxGeometry(w * 0.6, h * 0.1, w * 0.55),
      redLightMat);
    lay3.position.set(x, h * 0.9 + h * 0.05, z); parent.add(lay3);
  }

  const spireMat = new T.MeshLambertMaterial({ color: 0xc05030 });
  const spireSpots = [
    [-20, -55, 4, 24], [25, -100, 3, 18], [-22, -180, 4, 26],
    [28, -220, 3, 20], [-26, -270, 5, 28], [24, -310, 4, 22],
  ];
  for (const [x, z, r, h] of spireSpots) {
    const spire = new T.Mesh(new T.CylinderGeometry(r * 0.6, r, h, 6), spireMat);
    spire.position.set(x, h/2, z);
    spire.castShadow = true;
    parent.add(spire);
    const cap = new T.Mesh(new T.CylinderGeometry(r * 0.7, r * 0.6, h * 0.06, 6),
      new T.MeshLambertMaterial({ color: 0xa03020 }));
    cap.position.set(x, h + h * 0.03, z); parent.add(cap);
  }

  const wallMat = new T.MeshLambertMaterial({ color: 0x6a2a18 });
  for (let i = 0; i < 10; i++) {
    const x = -150 + i * 32;
    const h = 50 + (i % 4) * 14;
    const wall = new T.Mesh(new T.BoxGeometry(36, h, 16), wallMat);
    wall.position.set(x, h/2, -420); parent.add(wall);
  }

  const boulderMat = new T.MeshLambertMaterial({ color: 0x8a3a20 });
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 8);
    const z = -20 - Math.random() * 320;
    const r = 1 + Math.random() * 1.5;
    const b = new T.Mesh(new T.SphereGeometry(r, 8, 6), boulderMat);
    b.position.set(x, r * 0.7, z);
    b.scale.set(1.2, 0.9, 1.0);
    parent.add(b);
  }

  const brushMat = new T.MeshLambertMaterial({ color: 0x6a7030 });
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12);
    const z = -25 - Math.random() * 340;
    const b = new T.Mesh(new T.SphereGeometry(0.6, 6, 5), brushMat);
    b.position.set(x, 0.4, z); b.scale.y = 0.6;
    parent.add(b);
  }
}

// ===========================================================================
// DESERT · D · SAGUARO — saguaro cacti, rolling tan hills, water tower, fence
// ===========================================================================
export function buildSaguaro(parent, T) {
  const hillMat = new T.MeshLambertMaterial({ color: 0x8a7050 });
  for (let i = 0; i < 14; i++) {
    const x = -160 + i * 24;
    const h = 16 + (i % 5) * 5;
    const hill = new T.Mesh(new T.SphereGeometry(20, 12, 8), hillMat);
    hill.position.set(x, -2, -380);
    hill.scale.set(1.2, h / 22, 1.0);
    parent.add(hill);
  }
  const fgHillMat = new T.MeshLambertMaterial({ color: 0xa08260 });
  for (let i = 0; i < 8; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (50 + (i % 3) * 8);
    const z = -80 - i * 40;
    const hill = new T.Mesh(new T.SphereGeometry(12, 10, 7), fgHillMat);
    hill.position.set(x, -1, z);
    hill.scale.set(1.4, 0.55, 1.0);
    parent.add(hill);
  }

  function makeSaguaro(armConfig) {
    const sag = new T.Group();
    const cactusMat = new T.MeshLambertMaterial({ color: 0x4a8a4a });
    const trunk = new T.Mesh(new T.CylinderGeometry(0.5, 0.6, 6, 10), cactusMat);
    trunk.position.y = 3;
    trunk.castShadow = true;
    sag.add(trunk);
    const cap = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), cactusMat);
    cap.position.y = 6; sag.add(cap);
    for (const [yoff, side, armH] of armConfig) {
      const armR = 0.3, horizLen = 1.2;
      const elbowX = side * (0.5 + horizLen);
      const horiz = new T.Mesh(
        new T.CylinderGeometry(armR, armR, horizLen, 8), cactusMat);
      horiz.rotation.z = Math.PI / 2;
      horiz.position.set(side * (0.5 + horizLen / 2), yoff, 0);
      sag.add(horiz);
      const elbow = new T.Mesh(new T.SphereGeometry(armR, 8, 6), cactusMat);
      elbow.position.set(elbowX, yoff, 0); sag.add(elbow);
      const vert = new T.Mesh(
        new T.CylinderGeometry(armR * 0.95, armR, armH, 8), cactusMat);
      vert.position.set(elbowX, yoff + armH / 2, 0);
      vert.castShadow = true;
      sag.add(vert);
      const armCap = new T.Mesh(new T.SphereGeometry(armR, 8, 6), cactusMat);
      armCap.position.set(elbowX, yoff + armH, 0); sag.add(armCap);
    }
    return sag;
  }
  const saguaroSpots = [
    [-22, -30,  [[3.5, 1, 2.8]]],
    [25, -55,   [[3, -1, 2.5], [4, 1, 1.8]]],
    [-26, -85,  [[3.5, 1, 2.5]]],
    [28, -120,  [[3, -1, 2.2], [4.2, 1, 2.4]]],
    [-30, -160, [[3.8, 1, 2.6]]],
    [25, -195,  [[3.2, -1, 2.4]]],
    [-28, -230, [[3.5, -1, 2.5], [4.0, 1, 2.0]]],
    [30, -270,  [[3.6, 1, 2.8]]],
    [-25, -310, [[3.4, 1, 2.2], [4.1, -1, 2.4]]],
    [27, -350,  [[3.8, -1, 2.5]]],
    [-50, -65,  [[3.5, 1, 2.6]]],
    [52, -110,  [[3, -1, 2.3]]],
    [-48, -180, [[3.7, 1, 2.4]]],
    [50, -250,  [[3.4, -1, 2.5], [4.2, 1, 2.0]]],
    [-46, -320, [[3.5, 1, 2.4]]],
  ];
  for (const [x, z, arms] of saguaroSpots) {
    const sag = makeSaguaro(arms);
    sag.position.set(x, 0, z);
    sag.rotation.y = Math.random() * Math.PI * 2;
    parent.add(sag);
  }

  const brushMat = new T.MeshLambertMaterial({ color: 0x6a6a3a });
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 30);
    const z = -15 - Math.random() * 350;
    const b = new T.Mesh(new T.SphereGeometry(0.7, 6, 5), brushMat);
    b.position.set(x, 0.5, z); b.scale.y = 0.7;
    parent.add(b);
  }

  const fenceMat = new T.MeshLambertMaterial({ color: 0x6a4a2c });
  for (let z = -10; z >= -360; z -= 8) {
    for (const fx of [-12, 12]) {
      const post = new T.Mesh(new T.BoxGeometry(0.25, 1.6, 0.25), fenceMat);
      post.position.set(fx, 0.8, z); parent.add(post);
    }
  }
  for (const fx of [-12, 12]) {
    for (const ry of [0.4, 1.1]) {
      const rail = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 350), fenceMat);
      rail.position.set(fx, ry, -185); parent.add(rail);
    }
  }

  const towerLegMat = new T.MeshLambertMaterial({ color: 0x6a4030 });
  for (const [x, z] of [[-60, -210]]) {
    for (const ldx of [-2, 2]) for (const ldz of [-2, 2]) {
      const leg = new T.Mesh(new T.BoxGeometry(0.4, 10, 0.4), towerLegMat);
      leg.position.set(x + ldx, 5, z + ldz); parent.add(leg);
    }
    const tank = new T.Mesh(new T.CylinderGeometry(3, 3, 4, 12),
      new T.MeshLambertMaterial({ color: 0x8a6a4a }));
    tank.position.set(x, 12, z);
    tank.castShadow = true;
    parent.add(tank);
    const roof = new T.Mesh(new T.ConeGeometry(3.2, 1.8, 12),
      new T.MeshLambertMaterial({ color: 0x4a3020 }));
    roof.position.set(x, 14.9, z); parent.add(roof);
  }
}

// ===========================================================================
// NIGHT · A · TOKYO NEON — buildings rotated 90°, neon edges, LED tire walls
// ===========================================================================
export function buildTokyo(parent, T) {
  const buildingMat = new T.MeshLambertMaterial({ color: 0x141820 });
  const neonColors = [0xff20a0, 0x40ffff, 0xffff40, 0xff4040, 0x40ff40];
  const winMat = new T.MeshBasicMaterial({ color: 0xffe080 });
  const winGeo = new T.BoxGeometry(0.8, 0.6, 0.05);

  for (let s = 0; s < 14; s++) {
    const sx = (s % 2 === 0 ? -1 : 1) * (24 + (s % 3) * 4);
    const sz = -15 - s * 24;
    const w = 14 + (s % 3) * 5;
    const h = 9 + (s % 4) * 3;
    const d = 12;

    const bldg = new T.Group();
    const b = new T.Mesh(new T.BoxGeometry(w, h, d), buildingMat);
    b.position.y = h/2; b.castShadow = true; bldg.add(b);
    const edge = new T.Mesh(new T.BoxGeometry(w + 0.2, 0.2, d + 0.2),
      new T.MeshBasicMaterial({ color: neonColors[s % 5] }));
    edge.position.y = h; bldg.add(edge);
    const winFaceZ = sx > 0 ? -d/2 - 0.05 : d/2 + 0.05;
    const winRows = Math.floor(h / 2) - 1;
    const winCols = Math.floor(w / 2.5) - 1;
    for (let r = 0; r < winRows; r++) {
      for (let c = 0; c < winCols; c++) {
        if (Math.random() < 0.55) {
          const win = new T.Mesh(winGeo, winMat);
          win.position.set(-w/2 + 1.4 + c * 2.4, 1 + r * 1.8, winFaceZ);
          bldg.add(win);
        }
      }
    }
    bldg.position.set(sx, 0, sz);
    bldg.rotation.y = Math.PI / 2;
    parent.add(bldg);
  }

  for (let i = 0; i < 4; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * 36;
    const z = -50 - i * 70;
    const sign = new T.Mesh(new T.BoxGeometry(0.3, 14, 2.5),
      new T.MeshBasicMaterial({ color: neonColors[i] }));
    sign.position.set(x, 14, z); parent.add(sign);
  }

  for (let z = -20; z >= -340; z -= 30) {
    for (const px of [-19, 19]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.3, 9, 0.3),
        new T.MeshLambertMaterial({ color: 0x202020 }));
      pole.position.set(px, 4.5, z); parent.add(pole);
      const bulb = new T.Mesh(new T.SphereGeometry(0.6, 12, 8),
        new T.MeshBasicMaterial({ color: 0xffd980 }));
      bulb.position.set(px, 9.2, z); parent.add(bulb);
      const halo = new T.Mesh(new T.CircleGeometry(2.5, 16),
        new T.MeshBasicMaterial({ color: 0xffd980, transparent: true, opacity: 0.15 }));
      halo.position.set(px, 9.2, z);
      halo.lookAt(px, 0, z + 1);
      parent.add(halo);
    }
  }

  const ledWallGeo = new T.BoxGeometry(0.4, 0.6, 2);
  const ledMat = new T.MeshBasicMaterial({ color: 0x40ffff });
  for (let z = -10; z >= -340; z -= 2.5) {
    for (const bx of [-9, 9]) {
      const led = new T.Mesh(ledWallGeo, ledMat);
      led.position.set(bx, 0.3, z); parent.add(led);
    }
  }

  const skylineMat = new T.MeshLambertMaterial({ color: 0x080a14 });
  for (let i = 0; i < 12; i++) {
    const x = -120 + i * 22;
    const h = 20 + (i % 5) * 8;
    const sky = new T.Mesh(new T.BoxGeometry(18, h, 12), skylineMat);
    sky.position.set(x, h/2, -380); parent.add(sky);
  }
}

// ===========================================================================
// NIGHT · B · VEGAS STRIP — casino marquees, spotlights, LED palm trees
// ===========================================================================
export function buildVegas(parent, T) {
  const casinoMat = new T.MeshLambertMaterial({ color: 0x1c1820 });
  const marqueeColors = [0xffe040, 0xff5040, 0xff20a0, 0x40c0ff, 0xa040ff];

  for (let s = 0; s < 10; s++) {
    const sx = (s % 2 === 0 ? -1 : 1) * (28 + (s % 2) * 6);
    const sz = -25 - s * 32;
    const w = 22 + (s % 3) * 4;
    const h = 16 + (s % 4) * 5;
    const d = 18;
    const c = new T.Mesh(new T.BoxGeometry(w, h, d), casinoMat);
    c.position.set(sx, h/2, sz); c.castShadow = true; parent.add(c);
    const facadeMat = new T.MeshBasicMaterial({ color: marqueeColors[s % 5] });
    const facade = new T.Mesh(new T.BoxGeometry(0.1, h * 0.85, d * 0.85), facadeMat);
    facade.position.set(sx + (sx > 0 ? -w/2 - 0.05 : w/2 + 0.05), h/2, sz);
    parent.add(facade);
    const marquee = new T.Mesh(new T.BoxGeometry(0.3, 5, 14),
      new T.MeshBasicMaterial({ color: marqueeColors[(s + 2) % 5] }));
    marquee.position.set(sx + (sx > 0 ? -w/2 - 0.4 : w/2 + 0.4), h + 2.5, sz);
    parent.add(marquee);
    for (let lz = -5; lz <= 5; lz += 2.5) {
      const ltr = new T.Mesh(new T.BoxGeometry(0.05, 2, 1.3),
        new T.MeshBasicMaterial({ color: 0xfff8b0 }));
      ltr.position.set(sx + (sx > 0 ? -w/2 - 0.6 : w/2 + 0.6), h + 2.5, sz + lz);
      parent.add(ltr);
    }
    for (let row = 1; row < Math.floor(h / 2.5); row++) {
      const strip = new T.Mesh(new T.BoxGeometry(0.05, 0.8, d * 0.92),
        new T.MeshBasicMaterial({ color: 0xfff0a0 }));
      strip.position.set(sx + (sx > 0 ? -w/2 - 0.05 : w/2 + 0.05), row * 2.5, sz);
      parent.add(strip);
    }
  }

  const beamMat = new T.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.18,
  });
  for (let i = 0; i < 6; i++) {
    const x = (i % 2 === 0 ? -1 : 1) * (28 + (i % 2) * 6);
    const z = -40 - i * 50;
    const beam = new T.Mesh(new T.CylinderGeometry(0.4, 5, 60, 12, 1, true), beamMat);
    beam.position.set(x, 32, z);
    beam.rotation.z = (Math.random() - 0.5) * 0.3;
    parent.add(beam);
    const bulb = new T.Mesh(new T.SphereGeometry(0.6, 10, 8),
      new T.MeshBasicMaterial({ color: 0xffffff }));
    bulb.position.set(x, 5, z); parent.add(bulb);
  }

  for (let z = -20; z >= -340; z -= 28) {
    for (const tx of [-13, 13]) {
      const trunk = new T.Mesh(new T.CylinderGeometry(0.3, 0.45, 8, 8),
        new T.MeshLambertMaterial({ color: 0x4a3020 }));
      trunk.position.set(tx, 4, z);
      trunk.castShadow = true;
      parent.add(trunk);
      for (let ry = 0.5; ry <= 7.5; ry += 1.0) {
        const ring = new T.Mesh(new T.TorusGeometry(0.4, 0.06, 6, 16),
          new T.MeshBasicMaterial({
            color: [0xff20a0, 0x40ffff, 0xffff40][Math.floor(ry) % 3],
          }));
        ring.position.set(tx, ry, z);
        ring.rotation.x = Math.PI / 2;
        parent.add(ring);
      }
      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI * 2 + Math.PI / 4;
        const frond = new T.Mesh(new T.BoxGeometry(2.5, 0.1, 0.4),
          new T.MeshLambertMaterial({ color: 0x3a8a3a }));
        frond.position.set(tx + Math.cos(ang) * 1.3, 8.4,
                           z + Math.sin(ang) * 1.3);
        frond.rotation.y = -ang;
        frond.rotation.z = -0.3;
        parent.add(frond);
      }
    }
  }

  const horizonMat = new T.MeshBasicMaterial({
    color: 0xffaa40, transparent: true, opacity: 0.4,
  });
  const horizon = new T.Mesh(new T.PlaneGeometry(400, 30), horizonMat);
  horizon.position.set(0, 15, -400); parent.add(horizon);
}

// ===========================================================================
// DISPATCHER
// ===========================================================================
const BUILDERS = {
  amphitheater: buildAmphitheater,
  bleachers:    buildBleachers,
  industrial:   buildIndustrial,
  junkyard:     buildJunkyard,
  redrock:      buildRedRock,
  saguaro:      buildSaguaro,
  skyline:      buildSkyline,
  highway:      buildHighway,
  vegas:        buildVegas,
  tokyo:        buildTokyo,
};

/** Add the matching scenery to `parent` for the given env preset id.
 *  Falls back to amphitheater when an unknown id is passed. */
export function pickScenery(parent, presetId) {
  const T = window.THREE;
  const fn = BUILDERS[presetId] || BUILDERS.amphitheater;
  fn(parent, T);
}
