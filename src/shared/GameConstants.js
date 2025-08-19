// ✅ CONSOLIDATED: Shared game constants to eliminate duplication across client and server
// This file contains all game configuration values, constants, and shared data structures

// ===== MAP CONFIGURATION =====
export const MAP_CONFIG = {
  WIDTH: 13,
  HEIGHT: 13, 
  CELL_SIZE: 45, // CSS pixel size
  BLOCK_DENSITY: 0.6, // Probability of block generation
};

// ===== GAME TIMING CONFIGURATION =====
export const GAME_TIMING = {
  COUNTDOWN_DURATION: 10, // ✅ FIXED: 10-second countdown as per requirements
  GAME_DURATION: 180, // 3 minutes in seconds
  WAITING_DURATION: 20, // seconds to wait for players
  BOMB_TIMER: 3.0, // seconds before bomb explodes (decimal format)
  GAME_LOOP_INTERVAL: 100, // milliseconds between game loop ticks
  TIMER_INTERVAL: 1000, // milliseconds between timer updates
  CHAIN_EXPLOSION_DELAY: 100, // milliseconds delay between chain explosions
  GAME_STATE_BROADCAST_DELAY: 150, // milliseconds delay for game state broadcast
  GAME_END_RESET_DELAY: 10000, // milliseconds before game resets after ending
  STATE_SYNC_DELAY: 100, // milliseconds delay for state synchronization
};

// ===== PLAYER CONFIGURATION =====
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

// ===== STARTING POSITIONS =====
// ✅ UPDATED: Starting positions for 13x13 map (corner spawning with proper spacing)
export const STARTING_POSITIONS = [
  { x: 1, y: 1 },     // Top-left (center of 3x3 area)
  { x: 11, y: 1 },    // Top-right (center of 3x3 area)
  { x: 1, y: 11 },    // Bottom-left (center of 3x3 area)
  { x: 11, y: 11 }    // Bottom-right (center of 3x3 area)
];

// ===== CELL TYPES =====
export const CELL_TYPES = {
  EMPTY: 'empty',
  WALL: 'wall',
  BLOCK: 'block',
  SPAWN: 'spawn',
  SPAWN_SAFE: 'spawn-safe',
};

// ✅ CONSOLIDATED: Walkable cells array used in both client and server validation
export const WALKABLE_CELLS = [
  CELL_TYPES.EMPTY,
  CELL_TYPES.SPAWN,
  CELL_TYPES.SPAWN_SAFE
];

// ===== POWER-UP CONFIGURATION =====
export const POWER_UP_CONFIG = {
  SPAWN_CHANCE: 0.35, // 35% chance to spawn power-up when block is destroyed
  TYPES: ['bombs', 'flames', 'speed'],
  MAX_LIMITS: {
    bombs: 5,   // Maximum bombs a player can place simultaneously
    flames: 5,  // Maximum bomb explosion range
    speed: 3    // Maximum movement speed multiplier
  },
  EMOJIS: {
    bombs: '💣',   // Bombs power-up
    flames: '🔥',  // Flames power-up
    speed: '⚡'    // Speed power-up
  }
};

// ===== SPRITE CONFIGURATION =====
export const SPRITE_CONFIG = {
  PLAYER_SPRITES: {
    0: 'assets/chara_aka.png',     // Red player
    1: 'assets/chara_shiro.png',   // White/Blue player
    2: 'assets/chara_pink.png',    // Pink player
    3: 'assets/chara_kuro.png'     // Black player
  },
  FALLBACK_COLORS: {
    0: '#e74c3c', // Red
    1: '#3498db', // Blue
    2: '#f39c12', // Orange
    3: '#9b59b6'  // Purple
  }
};

// ===== MOVEMENT DIRECTIONS =====
export const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

// ===== GAME EVENTS =====
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

// ===== VALIDATION HELPERS =====
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

// ===== EXPLOSION CONFIGURATION =====
export const EXPLOSION_CONFIG = {
  MAX_CHAIN_DEPTH: 10, // Maximum chain reaction depth to prevent infinite loops
  SAFE_ZONE_SIZE: 3, // Size of safe zone around spawn points (3x3 area)
  FINAL_COUNTDOWN_THRESHOLD: 3, // Seconds - block new players during final countdown
};

// ===== SERVER CONFIGURATION =====
export const SERVER_CONFIG = {
  PORT: 9090,
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
  }
};

// ===== MIME TYPES FOR SERVER =====
export const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};
