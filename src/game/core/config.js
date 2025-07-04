/**
 * Game Configuration Constants for Bomberman DOM
 * Contains all game settings, constants, and configuration values
 */

export const GameConfig = {
  // Game Board Configuration
  BOARD_WIDTH: 15,
  BOARD_HEIGHT: 13,
  CELL_SIZE: 32,

  // Player Configuration
  PLAYER_LIVES: 3,
  PLAYER_SPEED: 150, // milliseconds per move
  
  // Player Starting Position (single player)
  PLAYER_SPAWN_POSITION: { x: 1, y: 1 }, // Top Left corner
  
  // Safe zones around spawn points (no blocks can be placed here)
  SAFE_ZONE_RADIUS: 2,
  
  // Bomb Configuration
  BOMB_TIMER: 3000, // 3 seconds in milliseconds
  DEFAULT_BOMB_RANGE: 1,
  MAX_BOMB_RANGE: 5,
  DEFAULT_BOMB_CAPACITY: 1,
  MAX_BOMB_CAPACITY: 8,
  
  // Explosion Configuration
  EXPLOSION_DURATION: 500, // milliseconds
  
  // Block Configuration
  BLOCK_DENSITY: 0.7, // Percentage of destructible blocks on the board
  
  // Power-up Configuration
  POWERUP_DROP_CHANCE: 0.3, // 30% chance to drop power-up when block is destroyed
  POWERUP_TYPES: {
    BOMB: 'bomb',       // +1 bomb capacity
    FLAME: 'flame',     // +1 explosion range
    SPEED: 'speed'      // Increased movement speed
  },
  
  // Power-up Effects
  POWERUP_EFFECTS: {
    BOMB: { bombCapacity: 1 },
    FLAME: { bombRange: 1 },
    SPEED: { speedMultiplier: 0.8 } // Reduces movement time by 20%
  },
  
  // Game Timing Configuration
  GAME_DURATION: 300000,       // 5 minutes maximum game duration

  // Performance Configuration
  TARGET_FPS: 60,
  PERFORMANCE_MONITOR_INTERVAL: 1000, // Update performance stats every second
  
  // UI Configuration
  CHAT_MESSAGE_LIMIT: 50,      // Maximum chat messages to keep in memory
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },
  
  // Input Configuration
  INPUT_BUFFER_SIZE: 10,       // Number of input commands to buffer
  INPUT_REPEAT_DELAY: 100,     // Milliseconds before key repeat
  
  // Audio Configuration (for future implementation)
  AUDIO_ENABLED: true,
  MASTER_VOLUME: 0.7,
  SFX_VOLUME: 0.8,
  MUSIC_VOLUME: 0.5,
  
  // Debug Configuration
  DEBUG_MODE: false,
  SHOW_PERFORMANCE_MONITOR: false,
  LOG_NETWORK_MESSAGES: false,
  
  // Game States
  GAME_STATES: {
    WAITING: 'waiting',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
  },
  
  // Player States
  PLAYER_STATES: {
    ALIVE: 'alive',
    DEAD: 'dead',
    RESPAWNING: 'respawning',
    DISCONNECTED: 'disconnected'
  },
  
  // Cell Types
  CELL_TYPES: {
    EMPTY: 'empty',
    WALL: 'wall',
    BLOCK: 'block',
    BOMB: 'bomb',
    EXPLOSION: 'explosion',
    POWERUP: 'powerup'
  },
  
  // Game Action Types (for single player)
  ACTION_TYPES: {
    PLAYER_MOVE: 'player_move',
    PLACE_BOMB: 'place_bomb',
    GAME_START: 'game_start',
    GAME_OVER: 'game_over',
    GAME_PAUSE: 'game_pause',
    GAME_RESUME: 'game_resume'
  },
  
  // Error Types
  ERROR_TYPES: {
    NETWORK_ERROR: 'network_error',
    GAME_ERROR: 'game_error',
    VALIDATION_ERROR: 'validation_error',
    SERVER_ERROR: 'server_error'
  },
  
  // Validation Rules
  VALIDATION: {
    NICKNAME_MIN_LENGTH: 2,
    NICKNAME_MAX_LENGTH: 20,
    NICKNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
    CHAT_MESSAGE_MAX_LENGTH: 200
  },
  
  // CSS Classes for Game Elements
  CSS_CLASSES: {
    PLAYER: 'player',
    BOMB: 'bomb',
    EXPLOSION: 'explosion',
    BLOCK: 'block',
    WALL: 'wall',
    POWERUP: 'powerup',
    CELL: 'cell'
  },
  
  // Color Scheme
  COLORS: {
    PLAYERS: ['#ff0000', '#0000ff', '#00ff00', '#ffff00'],
    BACKGROUND: '#1a1a1a',
    SURFACE: '#2d2d2d',
    PRIMARY: '#ff6b35',
    SECONDARY: '#f7931e',
    ACCENT: '#ffcc02'
  }
};

// Environment-specific configuration
if (typeof window !== 'undefined') {
  // Browser environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    GameConfig.SERVER_URL = `${protocol}//${hostname}:${GameConfig.SERVER_PORT}`;
  } else {
    // For local development, use the current port if different from default
    const currentPort = window.location.port || '3001';
    GameConfig.SERVER_URL = `${protocol}//${hostname}:${currentPort}`;
  }
  
  // Enable debug mode in development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    GameConfig.DEBUG_MODE = true;
    GameConfig.SHOW_PERFORMANCE_MONITOR = true;
    GameConfig.LOG_NETWORK_MESSAGES = true;
  }
}

// Freeze the configuration to prevent accidental modifications
Object.freeze(GameConfig);
Object.freeze(GameConfig.PLAYER_SPAWN_POSITIONS);
Object.freeze(GameConfig.POWERUP_TYPES);
Object.freeze(GameConfig.POWERUP_EFFECTS);
Object.freeze(GameConfig.ANIMATION_DURATION);
Object.freeze(GameConfig.GAME_STATES);
Object.freeze(GameConfig.PLAYER_STATES);
Object.freeze(GameConfig.CELL_TYPES);
Object.freeze(GameConfig.MESSAGE_TYPES);
Object.freeze(GameConfig.ERROR_TYPES);
Object.freeze(GameConfig.VALIDATION);
Object.freeze(GameConfig.CSS_CLASSES);
Object.freeze(GameConfig.COLORS);
