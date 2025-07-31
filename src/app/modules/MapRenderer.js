// ✅ CONSOLIDATED: Import shared constants to eliminate duplication
import { SPRITE_CONFIG, POWER_UP_CONFIG } from '../../shared/GameConstants.js';

export class MapRenderer {
  constructor(framework) {
    this.framework = framework;
    
    // Map rendering state
    this.lastGameMapState = null;
    this.dirtyMapCells = new Set();
    this.hasRenderedMapOnce = false;
    this.gameMapCache = new Map();
    
    // Entity pooling for performance
    this.entityPool = {
      bombs: [],
      explosions: [],
      powerUps: []
    };
    
    // Track entity states for selective updates
    this.lastRenderedEntities = {
      players: new Map(),
      bombs: new Map(),
      powerUps: new Map()
    };
    
    // Rendering optimization settings
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    this.lastRenderStateSignature = '';

    // ✅ CONSOLIDATED: Use shared constants instead of duplicating
    this.SPRITE_MAP = SPRITE_CONFIG.PLAYER_SPRITES;
    this.POWER_UP_EMOJIS = POWER_UP_CONFIG.EMOJIS;
    this.FALLBACK_COLORS = SPRITE_CONFIG.FALLBACK_COLORS;
  }

  // ===== MAIN RENDERING FUNCTIONS =====

  renderGameMap(gameState) {
    const map = gameState.map;
    const players = gameState.players;
    const bombs = gameState.bombs || [];
    const powerUps = gameState.powerUps || [];

    return map.map((row, y) =>
      row.map((cell, x) => {
        const playersAtPosition = Object.values(players).filter(p => p.x === x && p.y === y);
        const bombsAtPosition = bombs.filter(b => b.x === x && b.y === y);
        const powerUpsAtPosition = powerUps.filter(p => p.x === x && p.y === y);

        return `
          <div class="cell ${cell}" id="cell-${x}-${y}" data-x="${x}" data-y="${y}">
            ${powerUpsAtPosition.map(powerUp =>
              `<div class="powerup powerup-${powerUp.type}" data-powerup-id="${powerUp.id}">
                ${this.getPowerUpEmoji(powerUp.type)}
              </div>`
            ).join('')}
            ${bombsAtPosition.map(() =>
              `<div class="bomb">💣</div>`
            ).join('')}
            ${playersAtPosition.map((player) => {
              const playerKeys = Object.keys(players);
              const playerIndex = playerKeys.indexOf(player.id);
              return this.generatePlayerHTML(player, playerIndex);
            }).join('')}
          </div>
        `;
      }).join('')
    ).join('');
  }



  renderFullGameMap(gameState) {
    console.log('MapRenderer: Starting full map render');
    const gameMapElement = this.framework.getCachedElement('game-map') ||
                          this.framework.cacheElement('game-map', document.getElementById('game-map'));
    
    if (!gameMapElement || !gameState) {
      console.log('MapRenderer: No game map element or game state');
      return;
    }

    console.log('MapRenderer: Rendering map with', gameState.map.length, 'rows');
    gameMapElement.innerHTML = this.renderGameMap(gameState);

    // ✅ NEW: Setup sprite loading for HTML-generated players
    this.setupPlayerSprites(gameMapElement);

    // Initialize the last state for selective updates
    this.lastGameMapState = this.createMapStateSnapshot(
      gameState.map,
      gameState.players,
      gameState.bombs || [],
      gameState.powerUps || []
    );

    this.hasRenderedMapOnce = true;
    console.log('MapRenderer: Full map render complete');
  }

  updateGameMapOptimized(gameState, currentTime) {
    if (!gameState || !gameState.map) {
      console.log('MapRenderer: No game state or map');
      return;
    }

    const gameMapElement = this.framework.getCachedElement('game-map') ||
                          this.framework.cacheElement('game-map', document.getElementById('game-map'));

    if (!gameMapElement) {
      console.log('MapRenderer: No game map element found');
      return;
    }

    console.log('MapRenderer: Rendering map...');
    
    // Force initial render, then use optimization for subsequent renders
    if (!this.hasRenderedMapOnce) {
      console.log('First time rendering map - forcing full render');
      this.renderFullGameMap(gameState);
      return;
    }

    // Skip rendering if no meaningful changes occurred
    if (this.shouldSkipRendering(currentTime)) {
      console.log('Skipping rendering - no significant changes detected');
      return;
    }

    // Use selective rendering for optimal performance
    this.updateGameMapSelective(gameState);
  }

  updateGameMapSelective(gameState) {
    const map = gameState.map;
    const players = gameState.players;
    const bombs = gameState.bombs || [];
    const powerUps = gameState.powerUps || [];

    // Check which cells need updates
    this.identifyDirtyCells(map, players, bombs, powerUps);

    // Process dirty cells using framework's batch update system
    this.processDirtyCells(map, players, bombs, powerUps);
  }

  // ===== RENDERING OPTIMIZATION =====

  shouldSkipRendering(currentTime) {
    // Skip if there's been a recent invalid movement attempt
    if (this.lastInvalidMoveTime && (currentTime - this.lastInvalidMoveTime) < 50) {
      this.framework.incrementCounter('skipped-renders-invalid-move');
      return true;
    }

    // Skip if the same invalid move was just attempted
    if (this.lastInvalidMove && (currentTime - this.lastInvalidMoveTime) < 100) {
      this.framework.incrementCounter('skipped-renders-repeated-invalid');
      return true;
    }

    // Skip if no significant state changes occurred
    const currentStateSignature = this.generateRenderStateSignature();
    if (currentStateSignature === this.lastRenderStateSignature) {
      this.framework.incrementCounter('skipped-renders-no-changes');
      return true;
    }

    this.lastRenderStateSignature = currentStateSignature;
    return false;
  }

  generateRenderStateSignature() {
    // Create a simple signature of the current render state
    return `${Date.now()}-${Math.random()}`;
  }

  // ===== DIRTY CELL TRACKING =====

  identifyDirtyCells(map, players, bombs, powerUps) {
    // Create current state snapshot
    const currentState = this.createMapStateSnapshot(map, players, bombs, powerUps);

    // Compare with last state to find changes
    if (this.lastGameMapState) {
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          const currentCellState = currentState.get(cellKey);
          const lastCellState = this.lastGameMapState.get(cellKey);

          if (!lastCellState || JSON.stringify(currentCellState) !== JSON.stringify(lastCellState)) {
            this.dirtyMapCells.add(cellKey);
            this.framework.markElementDirty(`cell-${cellKey}`, currentCellState);
          }
        }
      }
    } else {
      // First render - mark all cells as dirty
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          this.dirtyMapCells.add(cellKey);
          this.framework.markElementDirty(`cell-${cellKey}`, currentState.get(cellKey));
        }
      }
    }

    // Store current state for next comparison
    this.lastGameMapState = currentState;
  }

  createMapStateSnapshot(map, players, bombs, powerUps) {
    const snapshot = new Map();
    
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const cellKey = `${x}-${y}`;
        const cellState = {
          cellType: map[y][x],
          players: Object.values(players).filter(p => p.x === x && p.y === y),
          bombs: bombs.filter(b => b.x === x && b.y === y),
          powerUps: powerUps.filter(p => p.x === x && p.y === y)
        };
        snapshot.set(cellKey, cellState);
      }
    }
    
    return snapshot;
  }

  processDirtyCells(map, players, bombs, powerUps) {
    const gameMapElement = this.framework.getCachedElement('game-map');
    if (!gameMapElement) return;

    // Ensure game map has proper structure for selective updates
    this.ensureGameMapStructure(gameMapElement, map);

    // Update only dirty cells
    this.dirtyMapCells.forEach(cellKey => {
      const [x, y] = cellKey.split('-').map(Number);
      const cellData = this.lastGameMapState.get(cellKey);

      this.framework.updateElement(`cell-${cellKey}`, (cellElement) => {
        this.renderCellContent(cellElement, x, y, cellData, map, players, bombs, powerUps);
      });
    });

    // Clear dirty cells after processing
    this.dirtyMapCells.clear();
  }

  ensureGameMapStructure(gameMapElement, map) {
    // Check if we need to create the initial structure
    if (gameMapElement.children.length === 0) {
      const mapHTML = map.map((row, y) =>
        row.map((cell, x) => {
          const cellElement = document.createElement('div');
          cellElement.className = `cell ${cell}`;
          cellElement.setAttribute('data-x', x);
          cellElement.setAttribute('data-y', y);
          cellElement.id = `cell-${x}-${y}`;

          // Cache the element in framework
          this.framework.cacheElement(`cell-${x}-${y}`, cellElement);

          return cellElement;
        })
      );

      // Flatten and append all cells
      mapHTML.flat().forEach(cellElement => {
        gameMapElement.appendChild(cellElement);
      });
    }
  }

  renderCellContent(cellElement, _x, _y, cellData, _map, players, _bombs, _powerUps) {
    // Clear existing content
    cellElement.innerHTML = '';

    // Update cell class
    cellElement.className = `cell ${cellData.cellType}`;

    // Add power-ups with hardware acceleration
    cellData.powerUps.forEach(powerUpData => {
      const powerUpElement = this.createPowerUpElement(powerUpData);
      cellElement.appendChild(powerUpElement);
    });

    // Add bombs with hardware acceleration
    cellData.bombs.forEach(bombData => {
      const bombElement = this.createBombElement(bombData);
      cellElement.appendChild(bombElement);
    });

    // Add players with hardware acceleration
    cellData.players.forEach((playerData) => {
      // Calculate correct player index based on player ID
      const playerKeys = Object.keys(players);
      const playerIndex = playerKeys.indexOf(playerData.id);
      const playerElement = this.createPlayerElement(playerData, playerIndex);
      cellElement.appendChild(playerElement);
    });
  }

  // ===== ELEMENT CREATION WITH OBJECT POOLING =====

  createPowerUpElement(powerUpData) {
    // ✅ FRAMEWORK: Use framework's createElement instead of document.createElement
    const powerUpElement = this.getPooledElement('powerUps') || this.framework.createElement('div');

    powerUpElement.className = `powerup powerup-${powerUpData.type}`;
    powerUpElement.setAttribute('data-powerup-id', powerUpData.id);
    powerUpElement.textContent = this.getPowerUpEmoji(powerUpData.type);
    powerUpElement.style.transform = 'translateZ(0)'; // Hardware acceleration

    return powerUpElement;
  }

  createBombElement(_bombData) {
    // ✅ FRAMEWORK: Use framework's createElement instead of document.createElement
    const bombElement = this.getPooledElement('bombs') || this.framework.createElement('div');

    bombElement.className = 'bomb';
    bombElement.textContent = '💣';
    bombElement.style.transform = 'translateZ(0)'; // Hardware acceleration

    return bombElement;
  }

  createPlayerElement(playerData, index) {
    // ✅ FRAMEWORK: Use framework's createElement instead of document.createElement
    const playerElement = this.getPooledElement('players') || this.framework.createElement('div');

    playerElement.className = `player player-${index}`;

    // Set text content for fallback (hidden by CSS when images load)
    playerElement.textContent = playerData.nickname.charAt(0).toUpperCase();

    // Hardware acceleration
    playerElement.style.transform = 'translateZ(0)';

    // ✅ NEW: Handle character sprite loading with fallback
    this.loadPlayerSprite(playerElement, index, playerData);

    return playerElement;
  }

  // ✅ NEW: Load player sprite images with fallback handling
  loadPlayerSprite(playerElement, playerIndex, playerData) {
    const spritePath = this.SPRITE_MAP[playerIndex];
    if (!spritePath) return;

    // Use shared sprite loading utility
    this.loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerData);
  }

  // ✅ CONSOLIDATED: Shared sprite loading utility to avoid duplication
  loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerData) {
    const img = new Image();

    img.onload = () => {
      // Image loaded successfully - apply sprite background
      console.log(`✅ Player sprite loaded successfully: ${spritePath}`);
      playerElement.style.backgroundImage = `url('${spritePath}')`;
      playerElement.style.backgroundSize = 'cover';
      playerElement.style.backgroundPosition = 'center';
      playerElement.style.backgroundRepeat = 'no-repeat';

      // Hide text content when image is loaded
      playerElement.style.fontSize = '0';
      playerElement.style.color = 'transparent';
    };

    img.onerror = () => {
      // Image failed to load - use fallback styling
      console.warn(`❌ Failed to load player sprite: ${spritePath}`);
      this.applyFallbackPlayerStyling(playerElement, playerIndex, playerData);
    };

    // Start loading the image
    img.src = spritePath;
  }

  // ✅ NEW: Apply fallback styling when images fail to load
  applyFallbackPlayerStyling(playerElement, playerIndex, playerData) {
    const color = this.FALLBACK_COLORS[playerIndex] || '#95a5a6';

    // Apply circular fallback styling
    playerElement.style.backgroundColor = color;
    playerElement.style.backgroundImage = 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 20%, transparent 20%)';
    playerElement.style.borderRadius = '50%';
    playerElement.style.fontSize = '14px';
    playerElement.style.color = 'white';
    playerElement.style.fontWeight = 'bold';

    // Handle both playerData object and string initial
    const playerInitial = typeof playerData === 'string' ? playerData : playerData.nickname.charAt(0).toUpperCase();
    playerElement.textContent = playerInitial;
  }

  // ✅ NEW: Generate player HTML for string-based rendering
  generatePlayerHTML(playerData, playerIndex) {
    const spritePath = this.SPRITE_MAP[playerIndex];
    const playerInitial = playerData.nickname.charAt(0).toUpperCase();

    // Generate HTML with both sprite and fallback styling
    return `<div class="player player-${playerIndex}"
                 style="background-image: url('${spritePath}');
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;"
                 data-player-id="${playerData.id}"
                 data-player-initial="${playerInitial}">${playerInitial}</div>`;
  }

  // ✅ NEW: Setup sprite loading for HTML-generated players
  setupPlayerSprites(gameMapElement) {
    const playerElements = gameMapElement.querySelectorAll('.player');

    playerElements.forEach(playerElement => {
      const playerInitial = playerElement.getAttribute('data-player-initial');
      const playerClass = Array.from(playerElement.classList).find(cls => cls.startsWith('player-'));

      if (!playerClass) return;

      const playerIndex = parseInt(playerClass.split('-')[1]);
      const spritePath = this.SPRITE_MAP[playerIndex];

      if (spritePath) {
        // Use shared sprite loading utility
        this.loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerInitial);
      }
    });
  }



  // ===== OBJECT POOLING SYSTEM =====

  getPooledElement(type) {
    const pool = this.entityPool[type];
    return pool && pool.length > 0 ? pool.pop() : null;
  }

  returnToPool(element, type) {
    if (element && this.entityPool[type]) {
      // Clean the element before returning to pool
      element.className = '';
      element.textContent = '';
      element.removeAttribute('data-powerup-id');
      element.style.transform = '';
      
      this.entityPool[type].push(element);
    }
  }

  cleanupRemovedElements() {
    // Return removed elements to their respective pools
    ['powerUps', 'bombs', 'players'].forEach(type => {
      const pool = this.entityPool[type];
      if (pool.length > 20) { // Limit pool size
        this.entityPool[type] = pool.slice(0, 20);
      }
    });
  }

  // ===== HELPER FUNCTIONS =====

  getPowerUpEmoji(powerUpType) {
    return this.POWER_UP_EMOJIS[powerUpType] || '💎'; // Default to gem if unknown type
  }

  // ===== INVALID MOVE TRACKING =====

  setInvalidMoveTime(time) {
    this.lastInvalidMoveTime = time;
  }

  setInvalidMove(move) {
    this.lastInvalidMove = move;
  }

  showExplosionEffect(position, explosions, _range = 1, chainDepth = 0) {
    console.log(`💥 SHOWING EXPLOSION at (${position.x}, ${position.y}) with ${explosions.length} affected cells - Chain depth: ${chainDepth}`);

    // ✅ FRAMEWORK: Use framework's getCachedElement instead of document.getElementById
    const gameMap = this.framework.getCachedElement('game-map');
    if (!gameMap) {
      console.error('❌ Game map element not found for explosion animation');
      return;
    }

    console.log('✅ Game map found:', gameMap);
    console.log('📍 Explosion cells:', explosions);

    // Create explosion animations on all affected cells
    explosions.forEach((cell) => {
      // First cell is bomb center, others are blast areas
      const type = (cell.x === position.x && cell.y === position.y) ? 'center' : 'blast';
      console.log(`🎆 Creating ${type} explosion at (${cell.x}, ${cell.y}) - Chain depth: ${chainDepth}`);

      // Add slight delay for chain reactions to create visual sequence
      const delay = chainDepth > 0 ? chainDepth * 50 : 0; // 50ms delay per chain level

      setTimeout(() => {
        this.createExplosionAnimation(cell.x, cell.y, type, chainDepth);
      }, delay);
    });

    // Cleanup after animation completes
    const cleanupDelay = 1200 + (chainDepth * 100); // Wait for animation to complete
    setTimeout(() => {
      console.log(`🧹 Cleaning up explosion animations for chain depth ${chainDepth}`);
      this.cleanupExplosionAnimations();
    }, cleanupDelay);
  }

  createExplosionAnimation(x, y, type = 'blast', chainDepth = 0) {
    console.log(`🎯 Creating ${type} explosion animation at (${x}, ${y}) - Chain depth: ${chainDepth}`);

    const gameMap = document.getElementById('game-map');
    if (!gameMap) {
      console.error('❌ Game map not found in createExplosionAnimation');
      return;
    }

    // Find the cell element
    const cellSelector = `[data-x="${x}"][data-y="${y}"]`;
    console.log(`🔍 Looking for cell with selector: ${cellSelector}`);

    const cellElement = gameMap.querySelector(cellSelector);
    if (!cellElement) {
      console.error(`❌ Cell element not found for explosion at (${x}, ${y})`);
      console.log('Available cells:', gameMap.querySelectorAll('[data-x][data-y]').length);
      // Debug: Log all available cells
      const allCells = gameMap.querySelectorAll('[data-x][data-y]');
      console.log('First 5 cells:', Array.from(allCells).slice(0, 5).map(cell => ({
        x: cell.getAttribute('data-x'),
        y: cell.getAttribute('data-y')
      })));
      return;
    }

    console.log(`✅ Found cell element for (${x}, ${y}):`, cellElement);

    // Create explosion element with simplified approach
    // ✅ FRAMEWORK: Use framework's createElement instead of document.createElement
    const explosionElement = this.framework.createElement('div');
    explosionElement.setAttribute('data-explosion', 'true');
    explosionElement.setAttribute('data-chain-depth', chainDepth.toString());

    // Add explosion content and classes based on type and chain depth
    if (type === 'center') {
      explosionElement.innerHTML = '💥';
      explosionElement.className = `explosion-effect explosion-center ${chainDepth > 0 ? 'chain-reaction' : ''}`;
    } else {
      explosionElement.innerHTML = '🔥';
      explosionElement.className = `explosion-effect explosion-blast ${chainDepth > 0 ? 'chain-reaction' : ''}`;
    }

    // Direct inline styles for reliability - Adjusted for multiple explosion cells
    explosionElement.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 1000;
      font-size: ${type === 'center' ? '3em' : '2.5em'};
      opacity: 1;
      transform: scale(1);
      animation: bomberman-explosion-pop 0.6s cubic-bezier(.68,-0.55,.27,1.55);
      text-shadow: 0 0 15px rgba(255, 100, 0, 0.9), 0 0 30px rgba(255, 150, 0, 0.7);
    `;

    // Add to cell with relative positioning
    cellElement.style.position = 'relative';
    cellElement.appendChild(explosionElement);

    // IMMEDIATE: Trigger animation immediately for visibility
    console.log(`🎬 Explosion element added to DOM at (${x}, ${y})`);
    console.log(`📏 Element dimensions:`, {
      width: explosionElement.offsetWidth,
      height: explosionElement.offsetHeight,
      visible: explosionElement.offsetParent !== null,
      innerHTML: explosionElement.innerHTML
    });
    console.log(`🎨 Element computed styles:`, {
      opacity: getComputedStyle(explosionElement).opacity,
      transform: getComputedStyle(explosionElement).transform,
      fontSize: getComputedStyle(explosionElement).fontSize,
      display: getComputedStyle(explosionElement).display
    });
    console.log(`✨ Created ${type} explosion animation at (${x}, ${y})`);
    console.log(`🔧 Element classes:`, explosionElement.className);
    console.log(`📍 Element parent:`, cellElement);
  }

  cleanupExplosionAnimations() {
    // ✅ FRAMEWORK: Use framework's findAll instead of document.querySelectorAll
    const explosionElements = this.framework.findAll('[data-explosion="true"]');
    explosionElements.forEach(element => {
      element.classList.add('explosion-fade-out');
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 300);
    });
    console.log(`Cleaned up ${explosionElements.length} explosion animations`);
  }

  animatePowerUpSpawn(powerUpId) {
    // ✅ FRAMEWORK: Use framework's find instead of document.querySelector
    const el = this.framework.find(`[data-powerup-id="${powerUpId}"]`);
    if (el) {
      el.classList.add('spawning');
      setTimeout(() => el.classList.remove('spawning'), 600);
    }
  }

  animatePowerUpCollected(powerUpId) {
    // ✅ FRAMEWORK: Use framework's find instead of document.querySelector
    const el = this.framework.find(`[data-powerup-id="${powerUpId}"]`);
    if (el) {
      el.classList.add('collected');
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 500);
    }
  }
}
