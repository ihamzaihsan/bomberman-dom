// ✅ CONSOLIDATED: Shared game constants (CommonJS version for server)
// This file contains all game configuration values, constants, and shared data structures

// ===== MAP CONFIGURATION =====
const MAP_CONFIG = {
  WIDTH: 12,
  HEIGHT: 12,
  CELL_SIZE: 45, // CSS pixel size
  BLOCK_DENSITY: 0.6, // Probability of block generation
};

// ===== GAME TIMING CONFIGURATION =====
const GAME_TIMING = {
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
const PLAYER_CONFIG = {
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
// ✅ CONSOLIDATED: Starting positions for 12x12 map (centered in 3x3 safe areas)
const STARTING_POSITIONS = [
  { x: 1, y: 1 },     // Top-left (center of 3x3 area)
  { x: 10, y: 1 },    // Top-right (center of 3x3 area)
  { x: 1, y: 10 },    // Bottom-left (center of 3x3 area)
  { x: 10, y: 10 }    // Bottom-right (center of 3x3 area)
];

// ===== CELL TYPES =====
const CELL_TYPES = {
  EMPTY: 'empty',
  WALL: 'wall',
  BLOCK: 'block',
  SPAWN: 'spawn',
  SPAWN_SAFE: 'spawn-safe',
};

// ✅ CONSOLIDATED: Walkable cells array used in both client and server validation
const WALKABLE_CELLS = [
  CELL_TYPES.EMPTY,
  CELL_TYPES.SPAWN,
  CELL_TYPES.SPAWN_SAFE
];

// ===== POWER-UP CONFIGURATION =====
const POWER_UP_CONFIG = {
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

// ===== EXPLOSION CONFIGURATION =====
const EXPLOSION_CONFIG = {
  MAX_CHAIN_DEPTH: 10, // Maximum chain reaction depth to prevent infinite loops
  SAFE_ZONE_SIZE: 3, // Size of safe zone around spawn points (3x3 area)
  FINAL_COUNTDOWN_THRESHOLD: 3, // Seconds - block new players during final countdown
};

// ===== SERVER CONFIGURATION =====
const SERVER_CONFIG = {
  PORT: 9090,
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
  }
};

// ===== DIRECTIONS =====
const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right'
};

// ===== VALIDATION HELPERS =====
const VALIDATION = {
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

// ===== MIME TYPES FOR SERVER =====
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json'
};

module.exports = {
  MAP_CONFIG,
  GAME_TIMING,
  PLAYER_CONFIG,
  STARTING_POSITIONS,
  CELL_TYPES,
  WALKABLE_CELLS,
  POWER_UP_CONFIG,
  EXPLOSION_CONFIG,
  SERVER_CONFIG,
  DIRECTIONS,
  VALIDATION,
  MIME_TYPES
};
