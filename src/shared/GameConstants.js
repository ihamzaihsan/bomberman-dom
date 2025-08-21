export const MAP_CONFIG = {
  WIDTH: 13,
  HEIGHT: 13, 
  CELL_SIZE: 45,
  BLOCK_DENSITY: 0.6,
};

export const GAME_TIMING = {
  COUNTDOWN_DURATION: 10,
  GAME_DURATION: 180, 
  WAITING_DURATION: 20, 
  BOMB_TIMER: 3.0, 
  GAME_LOOP_INTERVAL: 100, 
  TIMER_INTERVAL: 1000, 
  CHAIN_EXPLOSION_DELAY: 100, 
  GAME_STATE_BROADCAST_DELAY: 150,
  GAME_END_RESET_DELAY: 10000,
  STATE_SYNC_DELAY: 100,
};

export const PLAYER_CONFIG = {
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  STARTING_LIVES: 3,
  DEFAULT_MAX_BOMBS: 1,
  DEFAULT_BOMB_RANGE: 1,
  DEFAULT_SPEED: 1,
  NICKNAME_MIN_LENGTH: 2,
  NICKNAME_MAX_LENGTH: 20,
};

export const STARTING_POSITIONS = [
  { x: 1, y: 1 },  
  { x: 11, y: 1 },    
  { x: 1, y: 11 },   
  { x: 11, y: 11 }    
];

export const CELL_TYPES = {
  EMPTY: 'empty',
  WALL: 'wall',
  BLOCK: 'block',
  SPAWN: 'spawn',
  SPAWN_SAFE: 'spawn-safe',
};

export const WALKABLE_CELLS = [
  CELL_TYPES.EMPTY,
  CELL_TYPES.SPAWN,
  CELL_TYPES.SPAWN_SAFE
];

export const POWER_UP_CONFIG = {
  SPAWN_CHANCE: 0.35,
  TYPES: ['bombs', 'flames', 'speed'],
  MAX_LIMITS: {
    bombs: 5,   
    flames: 5,  
    speed: 3   
  },
  EMOJIS: {
    bombs: '💣',
    flames: '🔥',
    speed: '⚡'
  }
};

// ===== SPRITE CONFIGURATION =====
export const SPRITE_CONFIG = {
  PLAYER_SPRITES: {
    0: 'assets/chara_aka.png',
    1: 'assets/chara_shiro.png',
    2: 'assets/chara_pink.png',
    3: 'assets/chara_kuro.png'
  },
  FALLBACK_COLORS: {
    0: '#e74c3c',
    1: '#3498db',
    2: '#f39c12',
    3: '#9b59b6'
  }
};

export const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

export const GAME_EVENTS = {
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  GAME_STARTED: 'game_started',
  GAME_ENDED: 'game_ended',
  GAME_RESET: 'game_reset',
  PLAYER_MOVED: 'player_moved',
  BOMB_PLACED: 'bomb_placed',
  BOMB_EXPLODED: 'bomb_exploded',
  PLAYER_DAMAGED: 'player_damaged',
  PLAYER_ELIMINATED: 'player_eliminated',
  POWERUP_SPAWNED: 'powerup_spawned',
  POWERUP_COLLECTED: 'powerup_collected',
  COUNTDOWN_UPDATE: 'countdown_update',
  TIMER_UPDATE: 'timer_update',
  WAITING_TIMER_UPDATE: 'waiting_timer_update'
};

export const VALIDATION = {
  isValidPosition: (x, y) => {
    return x >= 0 && x < MAP_CONFIG.WIDTH && y >= 0 && y < MAP_CONFIG.HEIGHT;
  },
  
  isWalkableCell: (cellType) => {
    return WALKABLE_CELLS.includes(cellType);
  },
  
  isValidNickname: (nickname) => {
    return nickname && 
           nickname.length >= PLAYER_CONFIG.NICKNAME_MIN_LENGTH && 
           nickname.length <= PLAYER_CONFIG.NICKNAME_MAX_LENGTH;
  },
  
  isPlayerSpawnPoint: (x, y) => {
    return STARTING_POSITIONS.some(pos => pos.x === x && pos.y === y);
  }
};

export const EXPLOSION_CONFIG = {
  MAX_CHAIN_DEPTH: 10,
  SAFE_ZONE_SIZE: 3,
  FINAL_COUNTDOWN_THRESHOLD: 3,
};

export const SERVER_CONFIG = {
  PORT: 9090,
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
  }
};

export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};
