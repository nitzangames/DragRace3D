export const VERSION = 'v0.4.8';

export const FIXED_DT = 1 / 120;
export const MAX_DT = 1 / 30;

export const FINISH_LINE_M = 402.336;          // 1/4 mile in meters
export const GREEN_BAND_RPM = 800;              // width of the green shift window (rpm below redline); green_window = [redline - GREEN_BAND_RPM, redline]
export const BLOW_THRESHOLD_S = 1.0;            // RPM at limiter for this long → engine blown
export const LAUNCH_RPM_OPTIMAL_LOW = 0.50;     // fraction of car redline for ideal launch
export const LAUNCH_RPM_OPTIMAL_HIGH = 0.65;    // fraction of car redline for ideal launch (upper bound)
export const TREE_AMBER_INTERVAL_S = 0.4;       // delay between christmas-tree amber bulbs
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
