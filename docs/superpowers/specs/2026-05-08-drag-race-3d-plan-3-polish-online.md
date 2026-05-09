# Drag Race 3D — Plan 3 (Polish & Online) Design Spec

**Date:** 2026-05-08
**Branch:** `plan-3-polish-online` (off `main`)
**Status:** Approved by user

## Goal

Add audio, environment variety, weekly online leaderboard with ghost replay, and an NBucks gold shop to bring Drag Race 3D to launch readiness on play.nitzan.games. **Defer screenshot mode, thumbnail render, and platform deploy to post-Plan-3 testing.**

## Scope summary

| Pillar       | In scope                                                                                                         | Out of scope (deferred)                              |
|--------------|------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| Audio        | Procedural WebAudio engine drone + procedural one-shots (shift, blow, tree beep, limiter)                        | Music, voice-over, recorded samples                  |
| Environments | 4 presets (day/night/salt/rain) via lighting + sky + ground tint; class-gated unlock                             | New geometry, prop reskins, weather VFX volume       |
| Leaderboard  | Weekly fixed car+class RotW, top-10, ghost replay (30 Hz position sampling, ~5 KB attachment per ghost)          | Cross-week history, per-car leaderboards             |
| NBucks shop  | 5 gold-pack tiers (250/1500/3500/10000/25000 g for 1/5/10/25/50 NBucks); local NBucks balance, in-game confirm    | PlaySDK.purchase modal (API does not exist), refunds |
| Polish       | Pause-menu mute toggle, master volume slider                                                                     | Screenshot mode, thumbnail render, deploy            |

## Architecture

### New modules

```
js/
├── audio.js          ─ WebAudio singleton: engine drone + procedural one-shots
├── env-presets.js    ─ Pure data: day/night/salt/rain configs
├── ghost-recorder.js ─ Pre-allocated Float32Array(360 × 3) sampler, 30 Hz
├── ghost-renderer.js ─ Translucent third car, position lerped from buffer
├── leaderboard.js    ─ PlaySDK leaderboard wrapper + weekly seed selector
├── rotw-screen.js    ─ Race-of-the-week menu screen + race lifecycle
└── shop-screen.js    ─ NBucks gold-pack shop screen
```

### Modified files

- `js/career.js` — add `nbucks: 0` starting balance, `unlockedEnvs: ['day']`
- `js/career-flow.js` — pick env per race from class table; unlock on class advance
- `js/quick-race.js` — track-picker UI filtered by `unlockedEnvs`
- `js/env-builder.js` — implement `applyEnvPreset(envId)` swapping materials/lights without rebuilding
- `js/main.js` — audio lifecycle (init on first gesture, suspend/resume), title-screen entries for RotW + Shop, pause-menu mute toggle
- `js/race-logic.js` — edge hooks for shift/blow/tree events into `audio` and `ghostRecorder`
- `js/save.js` — persist `nbucks`, `unlockedEnvs`, `audio.muted`, `audio.volume`

### Data flow

```
                ┌──────────────────────────────────────────┐
                │            main.js render loop           │
                └───┬──────────┬──────────────┬────────────┘
                    │          │              │
                    ▼          ▼              ▼
              race-logic   audio.tick()  ghost-recorder.tick()
                  │           ▲                │
                  │           │                ▼
                  ├─edges────►│         Float32Array buffer
                  │  shift                     │
                  │  blow                      ▼   (on race end)
                  │  tree-beep         leaderboard.submitGhost()
                  ▼                            │
            ghost-renderer.draw()              ▼
                  ▲                    PlaySDK.submitScore
                  │                            │
            leaderboard.fetchTopGhost()────────┘
```

### Audio architecture

Single `AudioContext` lazily created on first user gesture (browser autoplay policy):

```
┌────────────────────────────────────────────────────────────┐
│ AudioContext                                               │
│                                                            │
│  Engine drone:                                             │
│   sawOsc ──┐                                               │
│   subOsc ──┼─► biquadLP ─► engineGain ─┐                   │
│                              ▲          │                  │
│                              │ gain modulated by f(rpm)    │
│                       freq = base × rpm/redline            │
│                                                            │
│  One-shot bus (per event creates short-lived chain):       │
│   noiseBuf ─► bandpass ─► oneShotGain (AHD env) ─┐         │
│                                                  │         │
│                                                  ▼         │
│                                           masterGain ──► destination
│                                            (mute toggle)   │
└────────────────────────────────────────────────────────────┘
```

Engine drone runs continuously while a race is active. One-shots are spawned on event edges and self-disconnect on envelope end.

Per-class tone variation: optional `audio: { filterCutoff, subDetune }` field added to each car balance entry (e.g., V8 = warmer LP, I4 = brighter cutoff). `audio.js` falls back to defaults when absent, so cars without the field still play.

### Environment presets

`js/env-presets.js` exports a frozen object keyed by env id:

```js
export const ENV_PRESETS = {
  day:   { sun: '#fff6d8', ambient: '#5a6878', ground: '#3a4858', sky: ['#7ab8e6','#bce0f5'], fog: 0.0008, lightIntensity: 1.1 },
  night: { sun: '#a0b8d6', ambient: '#1a2030', ground: '#15181d', sky: ['#0a0e18','#1a2436'], fog: 0.0014, lightIntensity: 0.5 },
  salt:  { sun: '#fff8e0', ambient: '#a0a8b0', ground: '#dadcd8', sky: ['#a0c0d8','#e0e8ec'], fog: 0.0006, lightIntensity: 1.4 },
  rain:  { sun: '#9aa6b6', ambient: '#3a4250', ground: '#1c2028', sky: ['#3a424c','#5a6068'], fog: 0.0020, lightIntensity: 0.65 },
};
```

`env-builder.js#applyEnvPreset(envId)` mutates existing material/light parameters in place; never rebuilds the scene graph (preserves InstancedMesh pools).

Class unlock table:

| Env   | Unlocks at | Career races where used                   |
|-------|------------|--------------------------------------------|
| day   | Always     | E, D class (most races)                    |
| night | Class D    | Final D race + occasional C/B              |
| salt  | Class B    | Final B race + occasional A                |
| rain  | Class Pro  | All Pro-class races                        |

Quick race exposes a track picker with locked entries grayed-out (parts-shop pattern).

### Ghost recorder + renderer

**Recorder** (`js/ghost-recorder.js`):
- Pre-allocated `Float32Array(360 × 3)` (~12s × 30 Hz × [worldZ, rpm, gear]).
- `start()`, `tick(t, dt, worldZ, rpm, gear)` — samples every 1/30s, no allocation in hot path.
- `finalize() → Uint8Array` — packs the live sample range to bytes for upload (3 × float32 = 12 bytes/sample, ≤4320 bytes raw).

**Renderer** (`js/ghost-renderer.js`):
- Loads ghost into a `Float32Array` (decoded from PlaySDK attachment).
- Each frame: binary-search for time bracket, lerp `worldZ`, drive `_ghostMesh` position. Transparent `MeshBasicMaterial` (~0.45 alpha, white tint) so it reads as a ghost.
- Renders in lane 1 (replaces opponent), reusing opponent body geometry.

**RotW solo race format:** Player's lane = lane 0, ghost = lane 1 (replaces opponent). No AI logic runs. Christmas tree, physics, and finish detection unchanged.

### Leaderboard wrapper

`js/leaderboard.js`:
- `weeklyChallenge()` — returns `{ carIdx, classIdx, week }` derived from `Math.floor(Date.now() / (7*86400_000))`. Deterministic mod over (cars × classes); seeded such that all cars rotate over many weeks.
- `boardKey(week)` — returns `"rotw-week-NNNN"` to keep weekly boards isolated server-side.
- `submitRun(week, etMs, ghostBytes)` — wraps `PlaySDK.submitScore`, attaches ghost as Uint8Array.
- `fetchTop(week, limit=10)` — wraps `PlaySDK.getLeaderboard`.
- `fetchTopGhost(week)` — wraps `PlaySDK.getTopAttachment`, returns decoded `Float32Array` or `null` if no top run yet.
- All functions short-circuit with empty/null results when PlaySDK is absent (dev mode).

### Shop screen

5 gold-pack tiles. NBucks balance shown at top (1 NBuck = $1 USD platform-side). Tap tile → in-game confirm modal → if confirmed:
1. `save.nbucks -= packCost`
2. `careerState.gold += packGold`
3. Persist via existing save path
4. Toast: "+N gold"

If `save.nbucks < packCost`: tile shows as locked (parts-shop pattern). A footer note: "Get more NBucks at play.nitzan.games" — text-only since no purchase API exists.

Tier table:

| Pack   | Cost (NBucks = USD) | Gold   | Bonus vs. linear |
|--------|---------------------|--------|------------------|
| Small  | 1   ($1)            | 250    | —                |
| Medium | 5   ($5)            | 1,500  | +20%             |
| Large  | 10  ($10)           | 3,500  | +40%             |
| Mega   | 25  ($25)           | 10,000 | +60%             |
| Whale  | 50  ($50)           | 25,000 | +100%            |

Pricing rationale: $1 = 250 gold (≈2.5 E-class wins or ~1 tier-1 mod). Large bonuses on top tiers steer players toward $10+ purchases. Final values are tunable in `js/balance.js`.

## Constraints flagged

- **No PlaySDK.purchase API** in current SDK builds across JSGames repos. NBucks remain local-state only; replenishment is platform-side.
- **Leaderboard attachment max 32 KB** (b64 encoded) per existing PlaySDK contract. Our ghost is well under (~5 KB raw).
- **Audio autoplay policy** requires first user gesture before resuming `AudioContext`. We initialize on the title screen's first tap.
- **Per-frame zero-allocation rule** still applies (carried over from Plans 1–2). Recorder uses pre-allocated `Float32Array`, audio uses long-lived oscillators where possible (drone) and short-lived for one-shots (acceptable since one-shots are rare and the scheduler GC's them).

## Persistence

`js/save.js` schema additions (versioned migration handles legacy saves):

```js
{
  // ...existing fields
  nbucks: 0,                         // starting NBucks balance (none — platform replenishes)
  unlockedEnvs: ['day'],             // grows with class advancement
  audio: { muted: false, volume: 0.7 }
}
```

## Testing strategy

- **Unit (node --test)**:
  - `audio.test.js` — mocks WebAudio; verifies oscillator wiring, gain ramps, suspend/resume calls
  - `env-presets.test.js` — verifies all 4 keys + required fields present
  - `ghost-recorder.test.js` — verifies sample rate, buffer bounds, finalize byte length
  - `leaderboard.test.js` — verifies weekly seed determinism + car/class rotation
  - `shop.test.js` — verifies pack pricing math, locked-when-low-nbucks predicate, gold grant + nbucks decrement
- **Visual (puppeteer)**:
  - Title screen with RotW + Shop entries
  - 4 environments rendered correctly
  - Ghost car visible alongside player during RotW playback
- **Integration**:
  - Full RotW race: pick week, race, submit ET+ghost, verify board fetch returns own entry
  - Shop: buy pack, verify gold/NBucks persistence across reload

## Risks

| Risk                                                          | Mitigation                                                                              |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Procedural audio sounds buzzy / harsh                         | Low-pass filter cutoff 800–2000 Hz; layer sub osc; tune per car class                   |
| Ghost desync from player physics changes                      | Bake car+class into ghost metadata; reject ghosts where car balance hash differs        |
| Browser blocks AudioContext on iframe load                    | Lazy init on first gesture; pause-menu hint if not yet started                          |
| Env preset materials shared across scenes mutate stale state  | `applyEnvPreset` always sets full set of material params, no partial mutation           |
| Leaderboard attachment fails to upload                        | Submit ET regardless; ghost upload is best-effort with null fallback                    |

## Out of scope (post-Plan-3)

- Screenshot mode (key-bound capture without HUD)
- `thumbnail.png` render task for play.nitzan.games tile
- Production deploy to platform CDN (per deploy-gating memory rule)
- Cross-week ghost archive
- Weather VFX (rain particles, neon signs)
- Music / voice
