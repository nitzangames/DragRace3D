# Drag Race 3D — Design Spec

- **Slug:** `drag-race-3d`
- **Platform:** play.nitzan.games (sandboxed iframe, 1080×1920 portrait canvas)
- **Stack:** three.js r128, vanilla JS, no bundler. Conforms to GamesPlatform `docs/game-dev-notes.md`
- **Scope target:** "Deep sim-lite" — full 6-class career, parts shop, per-car tuning, 23 cars, 4 environments, RotW spec-event leaderboard. NOS deferred to v2.
- **Spec date:** 2026-05-07

---

## 1. Overview

A two-button 1/4-mile drag racing game. Player holds GAS + SHIFT to stage, releases SHIFT at the green christmas-tree light to launch, then taps SHIFT to upshift through 4 gears, watching a tachometer for the just-before-redline shift point. Wins earn gold, spent in the garage on cars and parts. Climb 6 classes (E → Pro). 1v1 head-to-head against AI in career; spec-event ghost races for global leaderboard.

The game is a **physics-feel game with two-button input**. Tuning, parts, and class progression should make every race feel slightly different from the last.

## 2. Core race loop

### Controls
Two on-screen buttons:
- **GAS** (right thumb, large rounded rect, lower-right edge of screen)
- **SHIFT** (left thumb, large rounded rect, lower-left edge of screen)

### State machine

| State | Player input | Behavior |
|---|---|---|
| `intro` | none | ~2s camera flyby of player car at start line. |
| `staging` | hold GAS + SHIFT | Engine RPM rises with sustained gas, capped at `LAUNCH_RPM_MAX`. Player picks how high to rev for launch. |
| `tree` | continue holding | 3 amber bulbs cascade at 0.4s intervals → green. If SHIFT released before green, latch jump-start flag. |
| `launching` | release SHIFT, hold GAS | Compute reaction-time `rt` from green→release delta. Compute launch quality from RPM-at-release vs ideal. Apply tractive force, smoke-particle on wheelspin, bog if RPM too low. |
| `racing` | hold GAS, tap SHIFT | Each SHIFT tap snapshots current RPM → score against the green window → upshift. RPM drops to `target_rpm = current_rpm * gear_ratio_new / gear_ratio_old`. |
| `coast` | (hold gas) | Top gear straightaway until finish line crossed. |
| `finished` | none | Parachute animation, deceleration, transition to results card. |

### Failure modes (hard fails — race ends)
- **False start:** SHIFT released before green light. Engine cuts, race over, loss recorded.
- **Engine blown:** RPM held at limiter for > `BLOW_THRESHOLD_S` (default 1.0s), i.e. player didn't shift in time. Puff of smoke, car coasts to stop, race over.

### Soft penalties (race continues)
- **Bog:** Released SHIFT below `LAUNCH_RPM_OPTIMAL_LOW` → low torque on launch, slow start.
- **Wheelspin:** Released SHIFT above `LAUNCH_RPM_OPTIMAL_HIGH` → tractive force capped by tire grip, smoke particles, slow start.
- **Early shift:** SHIFT tap below green zone → torque drop in new gear, small ET cost.
- **Late shift (pre-blow):** RPM bouncing off limiter for < `BLOW_THRESHOLD_S` → small ET cost.

### Reaction time (RT)
Measured from `tree green` event to SHIFT release.
- Displayed numerically on results screen.
- Perfect tree (RT < 0.100s) → small ET advantage (e.g., −0.020s) and a 10% gold bonus.
- Slow RT (> 0.500s) → no penalty, just slow.

### Race-physics model (Approach 3 hybrid)

Per-car state: `{ x_along_strip, v, rpm, gear }`. Fixed step `FIXED_DT = 1/120s`:

```
target_rpm    = wheel_rps * gear_ratio[gear] * final_drive
rpm          += (target_rpm - rpm) * engine_response * dt
torque        = torqueCurve(rpm)                   // per-car curve
force         = torque * gear_ratio[gear] * final_drive / wheel_radius
force         = min(force, grip * mass * g)        // tire grip cap
force        -= drag_coef * v*v + rolling_resistance * mass
v            += force / mass * dt
x            += v * dt
```

Wheelspin = uncapped `force` exceeding grip cap, exposed via a `slip` flag for VFX.

### Shift quality scoring

`green_window` = `[redline - GREEN_BAND_RPM, redline]`, default `GREEN_BAND_RPM = 800`.

| Tap RPM | Result |
|---|---|
| In green window | Full power transfer, RPM drops cleanly. |
| Below green (early) | Torque drop in new gear, small ET cost. |
| Above redline (late) | Limiter bouncing for `t_late` ms. If `t_late > BLOW_THRESHOLD_S` → engine blown. Else small ET cost. |

## 3. Cars, classes, parts, tuning

### Class ladder (6 classes)

| Class | Theme | Target ET | Stock cars |
|---|---|---|---|
| E — Street | Compact / sedan | 14–16s | 4 |
| D — Modified | Hot hatch / pony car | 12–14s | 4 |
| C — Sport | Coupe | 10–12s | 4 |
| B — Muscle | Big-block GT | 8.5–10s | 4 |
| A — Supercar | Twin-turbo / hypercar | 7.5–9s | 4 |
| Pro — Unlimited | Top fuel / dragster | 5–7s | 3 |

**23 stock cars total.** Class advancement requires `CLASS_WINS_REQUIRED = 5` race wins in the current class. Player may also leapfrog by purchasing a higher-class car directly if they have the gold.

### Car archetypes (procedurally built three.js Groups, no `.glb` files)

- **E Sedan:** stubby compact body, upright cabin, small wheels, basic bumpers
- **D Hot Hatch:** lowered, wider wheel arches, small spoiler
- **C Sport Coupe:** long hood, fastback roofline, modest spoiler
- **B Muscle:** long wheelbase, large hood scoop, dual exhausts, fat rear tires
- **A Supercar Wedge:** low wide body, intake scoops on shoulders, big rear wing, rear haunches
- **Pro Top Fuel:** long thin tube chassis, exposed engine + supercharger, header pipes, tiny front wheels, massive rear slicks

Each archetype takes 2 colors (primary body, secondary cabin/glass) at runtime. The 4 stock cars per class differ by paint plus minor proportion tweaks (wheel size, spoiler size, hood ridge). Materials: `MeshLambertMaterial`. Geometry: ~600–1500 polys per car.

### Parts shop (5 slots per car)

| Slot | Tiers | Effect |
|---|---|---|
| Engine internals | 4 | Peak torque ↑, redline ↑ |
| Turbo / supercharger | 4 (or none) | Mid-RPM torque kick, peak boost |
| Transmission | 4 | Faster shift transition; tier 3+ unlocks gear-ratio tuning sliders |
| Tires | 4 | Grip coefficient ↑ (less wheelspin headroom required) |
| Weight reduction | 3 | Mass ↓ |

Parts are tiered prerequisites within a slot (must own tier 1 before buying tier 2 in that slot). Parts persist per-car (not per-class).

### Tuning (per-car-instance, saved)

- Launch RPM target (clamps `LAUNCH_RPM_MAX`)
- Tire pressure (front/rear) — affects effective grip coefficient
- Gear ratios 1–4 (only if Transmission tier 3+)
- Final drive ratio

### Paint (per-car-instance)

- Primary color (hex, picker)
- Secondary color (hex, picker)
- Stripe variant (`none | center | dual | racing`)

### Deferred to v2

- NOS / nitrous (no third button in v1)
- Custom liveries / decals / numbers
- Per-car suspension geometry tuning

## 4. Career, economy, Race of the Week

### Career save (PlaySDK.save/load)

```js
{
  version: 1,
  career: { classIndex, classWins, gold, currentCarId },
  garage: [
    { carId: 'e2',
      parts:  { engine: 2, turbo: 0, transmission: 1, tires: 2, weight: 0 },
      tune:   { launchRpm: 4200, tirePressure: [32, 28],
                gearRatios: [3.4, 2.1, 1.5, 1.0], finalDrive: 3.55 },
      paint:  { primary: '#2a8fd4', secondary: '#fff', stripe: 'none' } }
  ],
  settings: { quality: 'auto', vibration: true, audio: 1.0 }
}
```

### Economy (gold = soft currency)

| Action | Reward |
|---|---|
| Win career race | `class_base × 1.0` (E:100g, D:250g, C:600g, B:1500g, A:4000g, Pro:10000g) |
| Lose career race | `class_base × 0.20` (consolation) |
| Win Quick Race | `class_base × 0.5` |
| Perfect tree (RT < 0.100s) | `class_base × 0.10` bonus |
| RotW participation | 200g flat (capped per week) |

Car/part prices balanced so a player progresses through one class in ~10–15 races by reinvesting winnings.

**NBucks** (platform currency) only buys gold packs in the Shop screen. No NBucks-gated cars or parts. Memory-rule: game-minted soft currency for in-game economy.

### Race of the Week (RotW)

Each calendar week the platform fixes one event:
```
{ weekId, classIndex, carId, fixedTune, trackId }
```

Player flow: enter RotW → load spec car & tune (no garage modification) → race against a ghost (best leaderboard time replays as opponent if available, otherwise tuned AI) → submit ET to PlaySDK leaderboard → view top 100 + own rank.

**Ghost replay payload (per submission):** `{ rt, shiftTaps: [{rpm, gear}, ...], finalEt }` — ~40 bytes. The race plays back deterministically by feeding these inputs into the same physics model.

## 5. Visuals & audio

### Camera

Primary in-race camera = **chase, raised**:
- Position: `(playerLane, 2.4m, +6.5m)` relative to player car
- Look-at: `(playerLane × 0.8, 1.0m, -18m)`
- FOV 58°
- Both player car (lower frame) and opponent (next lane) visible
- Strip rushing under = strong speed cue

Other cameras (cockpit, side tracking, high cinematic) shipped as **selectable options in v2**, not v1.

### HUD (in-race overlay)

Layout C from mockups, with tach repositioned to upper portion to keep the road visible:
- **Large circular tachometer** centered horizontally, occupying upper-mid screen area. Sweep 270° from bottom-left to bottom-right. Green zone in last `GREEN_BAND_RPM` before redline. Red zone past redline. Center number = RPM digits, lower text = current gear.
- **GAS button** — bottom-right half of the bottom edge, ~140px tall, red/orange gradient.
- **SHIFT button** — bottom-left half of the bottom edge, ~140px tall, blue/grey gradient.
- **Top-left chip** — elapsed time (s.ss).
- **Top-right chip** — speed (mph).
- **Christmas tree** — 3D object on the median, NOT a HUD overlay.
- **Version string** — bottom corner, Caption (14px), 50% opacity.

Reaction time, ET breakdown, gold earned: shown post-race on a results card.

### Environments (4)

| ID | Name | Atmosphere | Class gating |
|---|---|---|---|
| `classic` | Classic Strip (day) | Blue sky, grandstands, warm sun | E, D |
| `night` | Night Strip | Stadium floods, sodium-orange glow on asphalt, dark navy sky, light haze | C, B |
| `salt` | Salt Flats | Golden dusk, white salt plain, distant low-poly mountains, no grandstands | A |
| `rain` | Rainy City Strip | Wet asphalt with puddle reflections, neon signs, tall buildings flanking, heavy fog | Pro |

Each environment uses the same primitives: strip plane (env-specific texture), surrounding ground plane (env-specific color), sky color, fog density, lighting rig (sun + ambient + hemi), and per-env decorative props (grandstands / floodlight poles / mountain cones / building boxes + neon emissives).

### Effects (pre-allocated pools, GAME_DEV_NOTES rules)

| Effect | Pool | Trigger | Tech |
|---|---|---|---|
| Tire smoke | 600 quads | wheelspin frames | `InstancedMesh(planeGeo, smokeMat, 600)`, `setMatrixAt` |
| Exhaust flame | 4 (toggle per car) | gas held + high RPM | colored sphere meshes, scale-pulse |
| Spark shower | 60 quads | engine-blown event | InstancedMesh, ring buffer |
| Speed lines | 30 segments | `v > 0.6 * top_speed` | LineSegments, scrolling UVs |
| Christmas tree bulbs | static | always | individual sphere meshes |

No per-frame allocations anywhere. All pools allocated in `gameData.alloc()`.

### Audio (procedural, no mp3 files)

- **Engine note:** dual sawtooth oscillators detuned for thickness, lowpass filter. Frequency ∝ RPM. Per-car timbre via filter cutoff + harmonic mix.
- **Shift sound:** filtered noise burst, ~80ms.
- **Tire chirp:** filtered noise, gain envelope.
- **Crowd ambience:** filtered noise modulated by `v`, low volume continuous.
- **Christmas tree beeps:** 440Hz amber, 880Hz green sine tones.
- **Engine blow:** down-pitched noise burst.

`PlaySDK.onPause` suspends `audioCtx`; `PlaySDK.onResume` resumes it.

### Quality settings (pause menu, persisted)

`Auto / Low / Medium / High` toggles:
- Shadow map (off / `BasicShadowMap` 512² / `BasicShadowMap` 1024²)
- DPR cap (1.0 / 1.25 / 1.5 / 1.5)
- Smoke pool size (200 / 400 / 600 / 600)
- Anisotropy (1 / 2 / 4 / 8)
- Antialias (off on Low/Medium; on otherwise)

Default: Auto = detect Android Chrome → Medium; iOS Safari → High; desktop → High.

## 6. File architecture

Mirrors FormulaChampions3D + the platform's `balance / gameData / logic` split (per `GAME_DEV_NOTES`).

```
DragRace3D/
├── index.html              # canvases (game-canvas + overlay-canvas), all DOM screens, hidden until shown
├── meta.json               # { slug: "drag-race-3d", title: "Drag Race 3D", tags: [...], thumbnail: "thumbnail.png" }
├── thumbnail.png           # 512×512, rendered from in-game three.js (showcase muscle car at start line, classic strip)
├── thumbnail.html          # render harness for thumbnail
├── render-thumbnail.js     # puppeteer driver
├── dev-server.sh           # local dev on port 8084
├── .zipignore              # exclude .superpowers/, docs/, tests/, dev tooling
├── css/
│   └── ui.css              # menu, garage, results, pause, shop screens
├── js/
│   ├── main.js             # rAF loop, screen routing, init, version string
│   ├── balance.js          # ALL designer constants (cars, parts, prices, classes, RPM curves, env params)
│   ├── gameData.js         # allocGameData(balance) — single mutable state object, pools alloc'd here
│   ├── input.js            # canvas pointer → gas/shift button state, latch jump-start
│   ├── race-logic.js       # tick(gameData, balance, dt) — physics + state machine
│   ├── tach.js             # rpm → tach geometry (canvas or SVG), shift-zone hit testing
│   ├── shift-scoring.js    # pure functions for shift quality + RT scoring
│   ├── ai.js               # opponent: per-class skill profile, samples (rt, shiftTaps) deterministically by car/seed
│   ├── car-models.js       # buildCar(carId) → THREE.Group; archetype builders (sedan/hatch/coupe/muscle/supercar/topfuel)
│   ├── env-builder.js      # envId → scene props (strip, dirt, sky, lights, fog, decoration)
│   ├── effects.js          # InstancedMesh pools (smoke, sparks, speed lines)
│   ├── audio.js            # procedural engine + shift + tree + crowd + blow
│   ├── camera3d.js         # raised-chase cam, intro flyby cam, results spin cam
│   ├── renderer3d.js       # build scene, per-frame draw, no mutation of gameData
│   ├── garage.js           # owned-cars list, parts shop, tuning sliders, paint picker
│   ├── career.js           # class progression, race-card generation, save/load via PlaySDK
│   ├── rotw.js             # leaderboard fetch / submit, ghost-replay opponent
│   ├── shop.js             # NBucks → gold packs (PlaySDK transactions)
│   ├── ghost-replay.js     # serialize/deserialize { rt, shiftTaps } → race playback
│   └── constants.js        # FIXED_DT, FINISH_LINE_M, BLOW_THRESHOLD_S, GREEN_BAND_RPM, etc.
└── tests/
    └── *.test.js           # vitest unit tests for shift-scoring, race-logic, ai sampler
```

### Two architectural rules (per GAME_DEV_NOTES)

1. `race-logic.js` reads only `(gameData, balance, dt)` — no globals.
2. `renderer3d.js` reads `gameData` only — never mutates.

### Versioning

`VERSION = 'v0.1.0'` constant in `constants.js`. Displayed as Caption on title screen + race HUD corner. Bumped every commit per platform rules.

## 7. Out of scope (v1) — deferred to v2

- Cockpit / side / high-cinematic cameras (chase only in v1; v2 adds the others as user-selectable)
- NOS / nitrous and a third on-screen button
- Custom liveries, decals, racing numbers (paint = primary + secondary + stripe variant only)
- Audio samples (procedural only)
- Mid-race rear-view mirror or minimap
- Pre-stage burnout minigame
- Manual clutch button (a 3rd input)
- Track variants beyond the 4 environments
- Live multiplayer 1v1 (RotW with async ghosts only in v1)
- Achievements / daily challenges
- Photo mode

## 8. Review gates / mockup checkpoints

The user has explicitly asked for visual review checkpoints **during implementation, before art is finalized**:

- **Gate A — Car archetypes finalized:** before populating the full 23-car roster, present three.js renders of each archetype with at least 2 paint variations per archetype. User approves silhouette and proportions.
- **Gate B — Environment finalized:** before populating decoration props at scale, present three.js renders of each of the 4 environments. User approves atmosphere and color palette.
- **Gate C — In-race HUD on real game-canvas:** when the gameplay loop is integrated, present a screenshot of the actual chase-camera mid-race view with the live HUD overlay. User approves before parts shop and career UI are built on top.
- **Gate D — Tuning feels:** after parts shop is wired but before final balancing, capture ET deltas across 4 representative tunes per class. User confirms tuning feels meaningful.

These gates become explicit milestones in the implementation plan.

## 9. Testing strategy

- **Unit tests (Vitest, run from platform repo):**
  - `shift-scoring.test.js` — green-zone scoring, RT scoring, blown-engine threshold
  - `race-logic.test.js` — physics step determinism, gear-shift RPM transitions, finish-line detection
  - `ai.test.js` — AI sampler is deterministic given seed
  - `ghost-replay.test.js` — serialize ↔ deserialize roundtrip; replay produces identical ET
- **AI calibration pass:** simulate 100 races per class against a reference player profile; verify ET distribution matches each class's target window.
- **Visual verification (Puppeteer):** screenshot the game-canvas at each integration milestone (post-launch, mid-race, finish, garage screen, parts shop). Confirm UI legibility on a 540×960 viewport (the platform's typical phone ratio).
- **Mobile perf check:** Chrome DevTools 4× CPU throttle, "Mobile" GPU emulation. Target: `gap max < 32ms`, `work avg < 8ms` per platform diagnostic overlay.

## 10. Open / TBD

- **Final balance tables** (car stats, part stat deltas, prices, AI difficulty curves) — TBD in implementation; will be tuned via the `balance.js` file and locked at Gate D.
- **RotW backend storage shape** — depends on PlaySDK leaderboard API capabilities; will be confirmed against `play-sdk.js` at the start of the RotW milestone.
- **Mobile haptic feedback** — gate-approved if PlaySDK exposes vibration; not blocking.
