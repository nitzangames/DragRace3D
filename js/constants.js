export const VERSION = 'v0.5.59';

export const FIXED_DT = 1 / 120;
export const MAX_DT = 1 / 30;

export const FINISH_LINE_M = 402.336;          // 1/4 mile in meters
export const GREEN_BAND_RPM = 800;              // width of the green shift window (rpm below redline); green_window = [redline - GREEN_BAND_RPM, redline]
export const BLOW_THRESHOLD_S = 1.0;            // RPM at limiter for this long → engine blown
export const LAUNCH_RPM_OPTIMAL_LOW = 0.50;     // fraction of car redline for ideal launch
export const LAUNCH_RPM_OPTIMAL_HIGH = 0.65;    // fraction of car redline for ideal launch (upper bound)
export const TREE_AMBER_INTERVAL_S = 0.6;       // delay between christmas-tree amber bulbs
export const TREE_AMBER_COUNT = 3;

export const NUM_CARS = 2;                      // player + opponent (Plan-1)
export const PLAYER_CAR_IDX = 0;
export const OPPONENT_CAR_IDX = 1;

export const LANE_OFFSET_X = 2.5;               // meters from strip centerline to lane center
export const STRIP_LENGTH_M = 700;              // visual extent

// --- Career / class progression (Plan 2) ---
export const NUM_CLASSES = 6;          // E, D, C, B, A, Pro
export const CLASS_WINS_REQUIRED = 5;  // class advancement threshold

// Class index → display name
export const CLASS_NAMES = ['E', 'D', 'C', 'B', 'A', 'Pro'];

// Base gold reward per class (won; lose = 20%, quick race = 50%)
export const CLASS_BASE_REWARD = [100, 250, 600, 1500, 4000, 10000];

// Bonus multipliers
export const PERFECT_RT_BONUS_FRAC = 0.10;  // perfect tree adds 10% of class_base
export const LOSE_REWARD_FRAC = 0.20;        // consolation
export const QUICK_RACE_REWARD_FRAC = 0.50;  // quick race vs career

// Save key (PlaySDK.save/load)
export const SAVE_KEY = 'drag-race-3d:career:v1';

// --- Plan 3: Polish & Online ---

// Env presets: ids of the 10 distinct track sceneries (was 4 lighting-only
// presets; expanded to 10 fully-built environments in scenery.js).
export const ENV_PRESET_IDS = [
  'amphitheater', 'bleachers',          // E-class starter tracks
  'industrial',   'junkyard',           // D-class urban grit
  'redrock',      'saguaro',            // C-class desert
  'skyline',      'highway',            // B-class urban
  'vegas',                               // A-class neon
  'tokyo',                               // Pro neon
];

// Class index → default career-race env. Each career race uses the class's
// signature track unless overridden. Amphitheater is the championship-tier
// final venue and only appears at Pro.
export const CLASS_ENV_TABLE = [
  'bleachers',     // E
  'industrial',    // D
  'redrock',       // C
  'skyline',       // B
  'vegas',         // A
  'amphitheater',  // Pro
];

// Class index at which each env unlocks for quick-race. Bleachers is the
// only class-0 starter; the rest unlock as the class ladder advances. Both
// neon tracks (tokyo, vegas) and the championship amphitheater unlock at
// the top of the ladder.
export const ENV_UNLOCK_CLASS = {
  bleachers:    0,
  industrial:   1,
  junkyard:     1,
  redrock:      2,
  saguaro:      2,
  skyline:      3,
  highway:      3,
  vegas:        4,
  tokyo:        4,
  amphitheater: 5,
};

// Legacy ID map — Plan-3 v0.5.5 used four lighting presets (day/night/salt/
// rain); load-time migration (save.js) maps any legacy ID to its new
// equivalent so existing careers don't lose their unlocks.
export const LEGACY_ENV_MAP = {
  day:   'amphitheater',
  night: 'tokyo',
  salt:  'bleachers',
  rain:  'vegas',
};

// Ghost replay
export const GHOST_SAMPLE_HZ = 30;          // samples/sec
export const GHOST_DURATION_S = 12;         // max race duration to size buffer
export const GHOST_FLOATS_PER_SAMPLE = 3;   // [worldZ, rpm, gear]

// Audio
export const MASTER_VOLUME_DEFAULT = 0.7;   // 0..1
export const ENGINE_BASE_FREQ_HZ = 60;      // pitch at idleRpm; scaled by rpm/redline at runtime

// Leaderboard
export const ROTW_BOARD_PREFIX = 'rotw-week-';
export const WEEK_MS = 7 * 86400 * 1000;
