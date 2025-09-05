export const MAP_CONFIG = {
  WIDTH: 13,
  HEIGHT: 13,
  BLOCK_DENSITY: 0.6,
};

export const GAME_TIMING = {
  COUNTDOWN_DURATION: 10,
  GAME_DURATION: 180,
  WAITING_DURATION: 20,
  BOMB_TIMER: 3.0,
  GAME_LOOP_INTERVAL: 100,
  TIMER_INTERVAL: 1000,
  GAME_END_RESET_DELAY: 10000,
};

export const PLAYER_CONFIG = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  STARTING_LIVES: 3,
  DEFAULT_MAX_BOMBS: 1,
  DEFAULT_BOMB_RANGE: 1,
  DEFAULT_SPEED: 1,
  MOVE_INTERVALS: { 1: 150, 2: 101, 3: 50 },
  NICKNAME_MIN_LENGTH: 2,
  NICKNAME_MAX_LENGTH: 20,
};

export const STARTING_POSITIONS = [
  { x: 1, y: 1 },
  { x: 11, y: 1 },
  { x: 1, y: 11 },
  { x: 11, y: 11 },
];

export const CELL_TYPES = {
  EMPTY: 'empty',
  WALL: 'wall',
  BLOCK: 'block',
  SPAWN: 'spawn',
  SPAWN_SAFE: 'spawn-safe',
};

export const WALKABLE_CELLS = [CELL_TYPES.EMPTY, CELL_TYPES.SPAWN, CELL_TYPES.SPAWN_SAFE];

export const POWER_UP_CONFIG = {
  SPAWN_CHANCE: 0.35,
  TYPES: ['bombs', 'flames', 'speed'],
  MAX_LIMITS: {
    bombs: 5,
    flames: 5,
    speed: 3,
  },
  EMOJIS: {
    bombs: '💣',
    flames: '🔥',
    speed: '⚡',
  },
};

// ===== SPRITE CONFIGURATION =====
export const SPRITE_CONFIG = {
  PLAYER_SPRITES: {
    0: '/assets/player-red.svg',
    1: '/assets/player-blue.svg',
    2: '/assets/player-pink.svg',
    3: '/assets/player-black.svg',
  },
  FALLBACK_COLORS: {
    0: '#e74c3c',
    1: '#3498db',
    2: '#f39c12',
    3: '#9b59b6',
  },
};

export const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
};

export const VALIDATION = {
  isValidPosition: (x, y) => {
    return x >= 0 && x < MAP_CONFIG.WIDTH && y >= 0 && y < MAP_CONFIG.HEIGHT;
  },

  isWalkableCell: (cellType) => {
    return WALKABLE_CELLS.includes(cellType);
  },
};

export const SERVER_CONFIG = {
  PORT: 9090,
};

export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
