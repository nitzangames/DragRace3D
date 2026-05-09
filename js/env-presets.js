/**
 * Plan-3 environment presets — one per ENV_PRESET_IDS entry. Each holds
 * lighting + atmospheric data; the matching scenery (grandstands, palms,
 * neon signs, etc.) is built by js/scenery.js#pickScenery.
 *
 * Colors are 0xRRGGBB integers (matches three.js Color.setHex).
 *   sun:            directional-light color (the "sun" / key light)
 *   ambient:        ambient-light color
 *   ground:         color of the dirt-runoff plane around the strip
 *   sky:            [topHex, bottomHex] — currently unused, kept for future
 *                   gradient-skybox work
 *   fog:            { near, far, color } — linear fog in scene units
 *   lightIntensity: directional-light multiplier (the "sun" intensity)
 */
export const ENV_PRESETS = Object.freeze({
  // ----- Stadium: classic NHRA / pro-track look -----
  amphitheater: {
    sun: 0xfff0d0, ambient: 0xa8b8d8, ground: 0x6a5a3c,
    sky: [0x9bb8d8, 0xd0e0f0], fog: { near: 80, far: 400, color: 0x9bb8d8 },
    lightIntensity: 1.1,
  },
  bleachers: {
    sun: 0xfff5d8, ambient: 0xb0bcc8, ground: 0x6a5a3c,
    sky: [0xa8c0dc, 0xd6e2f2], fog: { near: 90, far: 420, color: 0xa8c0dc },
    lightIntensity: 1.15,
  },
  // ----- Urban: industrial / outlaw / city / freeway -----
  industrial: {
    sun: 0xfff0d0, ambient: 0xa0a0a0, ground: 0x60554a,
    sky: [0xc0c0b8, 0xdcd8c8], fog: { near: 60, far: 380, color: 0xc0c0b8 },
    lightIntensity: 0.95,
  },
  junkyard: {
    sun: 0xffd8a0, ambient: 0xa49080, ground: 0x584030,
    sky: [0xb09a78, 0xd4bea0], fog: { near: 70, far: 360, color: 0xb09a78 },
    lightIntensity: 1.0,
  },
  skyline: {
    sun: 0xc0c8e0, ambient: 0x8c98b0, ground: 0x404550,
    sky: [0x6a7a95, 0xa0b0c8], fog: { near: 60, far: 360, color: 0x6a7a95 },
    lightIntensity: 0.9,
  },
  highway: {
    sun: 0xfff0d0, ambient: 0xa0a0a0, ground: 0x4a4a52,
    sky: [0xa8b0bc, 0xc8cfd8], fog: { near: 70, far: 380, color: 0xa8b0bc },
    lightIntensity: 1.05,
  },
  // ----- Desert: red rock / saguaro -----
  redrock: {
    sun: 0xff6028, ambient: 0xa07050, ground: 0x8a4830,
    sky: [0xe4a070, 0xf0c498], fog: { near: 60, far: 420, color: 0xe4a070 },
    lightIntensity: 1.3,
  },
  saguaro: {
    sun: 0xfff0c0, ambient: 0xc8b08c, ground: 0xa88860,
    sky: [0xe2c490, 0xf2d8a8], fog: { near: 100, far: 460, color: 0xe2c490 },
    lightIntensity: 1.25,
  },
  // ----- Night: vegas / tokyo neon -----
  vegas: {
    sun: 0xc080c0, ambient: 0x5a3868, ground: 0x2c1d34,
    sky: [0x14101e, 0x2a1832], fog: { near: 70, far: 380, color: 0x14101e },
    lightIntensity: 0.75,
  },
  tokyo: {
    sun: 0x80a0d0, ambient: 0x304060, ground: 0x222832,
    sky: [0x0a0e18, 0x1a2436], fog: { near: 60, far: 320, color: 0x0a0e18 },
    lightIntensity: 0.65,
  },
});
