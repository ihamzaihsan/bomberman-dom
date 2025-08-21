import { SPRITE_CONFIG, POWER_UP_CONFIG } from '../../shared/GameConstants.js';

export class MapRenderer {
  constructor(framework) {
    this.framework = framework;
    
    this.lastGameMapState = null;
    this.dirtyMapCells = new Set();
    this.hasRenderedMapOnce = false;
    this.gameMapCache = new Map();
    
    this.entityPool = {
      bombs: [],
      explosions: [],
      powerUps: []
    };
    
    this.lastRenderedEntities = {
      players: new Map(),
      bombs: new Map(),
      powerUps: new Map()
    };
    
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    this.lastRenderStateSignature = '';

    this.SPRITE_MAP = SPRITE_CONFIG.PLAYER_SPRITES;
    this.POWER_UP_EMOJIS = POWER_UP_CONFIG.EMOJIS;
    this.FALLBACK_COLORS = SPRITE_CONFIG.FALLBACK_COLORS;
  }

  resetRenderer() {
    this.lastGameMapState = null;
    this.dirtyMapCells = new Set();
    this.hasRenderedMapOnce = false;
    this.gameMapCache = new Map();
    this.lastRenderedEntities = {
      players: new Map(),
      bombs: new Map(),
      powerUps: new Map()
    };
    this.lastInvalidMoveTime = 0;
    this.lastInvalidMove = null;
    this.lastRenderStateSignature = '';
    console.log('MapRenderer: State reset for new game');
  }


  renderGameMap(gameState) {
    const map = gameState.map;
    const players = gameState.players;
    const bombs = gameState.bombs || [];
    const powerUps = gameState.powerUps || [];

    const mapFragment = document.createDocumentFragment();

    map.forEach((row, y) => {
      row.forEach((cell, x) => {
        const cellElement = this.framework.createElement('div', {
          className: `cell ${cell}`,
          id: `cell-${x}-${y}`,
          'data-x': x.toString(),
          'data-y': y.toString()
        });

        const playersAtPosition = Object.values(players).filter(p => p.x === x && p.y === y);
        const bombsAtPosition = bombs.filter(b => b.x === x && b.y === y);
        const powerUpsAtPosition = powerUps.filter(p => p.x === x && p.y === y);

        powerUpsAtPosition.forEach(powerUp => {
          const powerUpElement = this.createPowerUpElement(powerUp);
          this.framework.appendChild(cellElement, powerUpElement);
        });

        bombsAtPosition.forEach(bomb => {
          const bombElement = this.createBombElement(bomb);
          this.framework.appendChild(cellElement, bombElement);
        });

        playersAtPosition.forEach((player) => {
          const playerKeys = Object.keys(players);
          const playerIndex = playerKeys.indexOf(player.id);
          const playerElement = this.createPlayerElement(player, playerIndex);
          this.framework.appendChild(cellElement, playerElement);
        });

        this.framework.appendChild(mapFragment, cellElement);
      });
    });

    return mapFragment;
  }



  renderFullGameMap(gameState) {
    console.log('MapRenderer: Starting full map render');

    this.framework.clearAllCaches();
    let gameMapElement = this.framework.getCachedElement('game-map') || this.framework.find('#game-map');

    if (!gameMapElement) {
      console.log('MapRenderer: Game map element not found, retrying...');
      setTimeout(() => {
        this.renderFullGameMap(gameState);
      }, 100);
      return;
    }

    if (!gameState) {
      console.log('MapRenderer: No game state');
      return;
    }

    this.framework.cacheElement('game-map', gameMapElement);

    console.log('MapRenderer: Rendering map with', gameState.map.length, 'rows');
    gameMapElement.innerHTML = ''; 
    gameMapElement.appendChild(this.renderGameMap(gameState));

    this.setupPlayerSprites(gameMapElement);

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

    const gameMapElement = this.framework.getCachedElement('game-map') || this.framework.find('#game-map');

    if (!gameMapElement) {
      console.log('MapRenderer: No game map element found');
      return;
    }

    console.log('MapRenderer: Rendering map...');
    
    if (!this.hasRenderedMapOnce) {
      console.log('First time rendering map - forcing full render');
      this.renderFullGameMap(gameState);
      return;
    }

    if (this.shouldSkipRendering(currentTime)) {
      console.log('Skipping rendering - no significant changes detected');
      return;
    }

    this.updateGameMapSelective(gameState);
  }

  updateGameMapSelective(gameState) {
    const map = gameState.map;
    const players = gameState.players;
    const bombs = gameState.bombs || [];
    const powerUps = gameState.powerUps || [];

    this.identifyDirtyCells(map, players, bombs, powerUps);

    this.processDirtyCells(map, players, bombs, powerUps);
  }


  shouldSkipRendering(currentTime) {
    if (this.lastInvalidMoveTime && (currentTime - this.lastInvalidMoveTime) < 50) {
      this.framework.incrementCounter('skipped-renders-invalid-move');
      return true;
    }

    if (this.lastInvalidMove && (currentTime - this.lastInvalidMoveTime) < 100) {
      this.framework.incrementCounter('skipped-renders-repeated-invalid');
      return true;
    }

    const currentStateSignature = this.generateRenderStateSignature();
    if (currentStateSignature === this.lastRenderStateSignature) {
      this.framework.incrementCounter('skipped-renders-no-changes');
      return true;
    }

    this.lastRenderStateSignature = currentStateSignature;
    return false;
  }

  generateRenderStateSignature() {
    return `${Date.now()}-${Math.random()}`;
  }


  identifyDirtyCells(map, players, bombs, powerUps) {
    const currentState = this.createMapStateSnapshot(map, players, bombs, powerUps);

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
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          this.dirtyMapCells.add(cellKey);
          this.framework.markElementDirty(`cell-${cellKey}`, currentState.get(cellKey));
        }
      }
    }

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

    this.ensureGameMapStructure(gameMapElement, map);

    this.dirtyMapCells.forEach(cellKey => {
      const [x, y] = cellKey.split('-').map(Number);
      const cellData = this.lastGameMapState.get(cellKey);

      this.framework.updateElement(`cell-${cellKey}`, (cellElement) => {
        this.renderCellContent(cellElement, x, y, cellData, map, players, bombs, powerUps);
      });
    });

    this.dirtyMapCells.clear();
  }

  ensureGameMapStructure(gameMapElement, map) {
    if (gameMapElement.children.length === 0) {
      const mapFragment = document.createDocumentFragment();
      map.forEach((row, y) => {
        row.forEach((cell, x) => {
          const cellElement = this.framework.selectiveRenderer.createElement('div', {
            className: `cell ${cell}`,
            id: `cell-${x}-${y}`
          });
          cellElement.setAttribute('data-x', x);
          cellElement.setAttribute('data-y', y);

          this.framework.cacheElement(`cell-${x}-${y}`, cellElement);
          mapFragment.appendChild(cellElement);
        });
      });
      gameMapElement.appendChild(mapFragment);
    }
  }

  renderCellContent(cellElement, _x, _y, cellData, _map, players, _bombs, _powerUps) {
    this.framework.setContent(cellElement, '');

    cellElement.className = `cell ${cellData.cellType}`;

    cellData.powerUps.forEach(powerUpData => {
      const powerUpElement = this.createPowerUpElement(powerUpData);
      this.framework.appendChild(cellElement, powerUpElement);
    });

    cellData.bombs.forEach(bombData => {
      const bombElement = this.createBombElement(bombData);
      this.framework.appendChild(cellElement, bombElement);
    });

    cellData.players.forEach((playerData) => {
      const playerKeys = Object.keys(players);
      const playerIndex = playerKeys.indexOf(playerData.id);
      const playerElement = this.createPlayerElement(playerData, playerIndex);
      this.framework.appendChild(cellElement, playerElement);
    });
  }

  createPowerUpElement(powerUpData) {
    const powerUpElement = this.getPooledElement('powerUps') || this.framework.createElement('div', {
      className: `powerup powerup-${powerUpData.type}`,
      'data-powerup-id': powerUpData.id,
      textContent: this.getPowerUpEmoji(powerUpData.type),
      style: 'transform: translateZ(0)' 
    });

    return powerUpElement;
  }

  createBombElement(_bombData) {

    const bombElement = this.getPooledElement('bombs') || this.framework.createElement('div', {
      className: 'bomb',
      textContent: '💣',
      style: 'transform: translateZ(0)' 
    });

    return bombElement;
  }

  createPlayerElement(playerData, index) {
    const isGhost = !playerData.alive;
    const ghostClass = isGhost ? ' player-ghost' : '';

    const playerElement = this.getPooledElement('players') || this.framework.createElement('div', {
      className: `player player-${index}${ghostClass}`,
      textContent: playerData.nickname.charAt(0).toUpperCase(),
      style: `transform: translateZ(0);${
        isGhost ? 'opacity: 0.4; filter: grayscale(100%) brightness(0.7); pointer-events: none;' : ''
      }`,
      'data-player-id': playerData.id,
      'data-player-alive': playerData.alive
    });

    this.loadPlayerSprite(playerElement, index, playerData);

    return playerElement;
  }


  loadPlayerSprite(playerElement, playerIndex, playerData) {
    const spritePath = this.SPRITE_MAP[playerIndex];
    if (!spritePath) return;

    this.loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerData);
  }

  loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerData) {
    const img = new Image();

    img.onload = () => {
      console.log(`✅ Player sprite loaded successfully: ${spritePath}`);
      playerElement.style.backgroundImage = `url('${spritePath}')`;
      playerElement.style.backgroundSize = 'cover';
      playerElement.style.backgroundPosition = 'center';
      playerElement.style.backgroundRepeat = 'no-repeat';

      playerElement.style.fontSize = '0';
      playerElement.style.color = 'transparent';
    };

    img.onerror = () => {
      console.warn(`❌ Failed to load player sprite: ${spritePath}`);
      this.applyFallbackPlayerStyling(playerElement, playerIndex, playerData);
    };

    img.src = spritePath;
  }

  applyFallbackPlayerStyling(playerElement, playerIndex, playerData) {
    const color = this.FALLBACK_COLORS[playerIndex] || '#95a5a6';

    playerElement.style.backgroundColor = color;
    playerElement.style.backgroundImage = 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 20%, transparent 20%)';
    playerElement.style.borderRadius = '50%';
    playerElement.style.fontSize = '14px';
    playerElement.style.color = 'white';
    playerElement.style.fontWeight = 'bold';

    const playerInitial = typeof playerData === 'string' ? playerData : playerData.nickname.charAt(0).toUpperCase();
    playerElement.textContent = playerInitial;
  }

  generatePlayerHTML(playerData, playerIndex) {
    const spritePath = this.SPRITE_MAP[playerIndex];
    const playerInitial = playerData.nickname.charAt(0).toUpperCase();

    const isGhost = !playerData.alive;
    const ghostClass = isGhost ? ' player-ghost' : '';
    const ghostStyle = isGhost ?
      'opacity: 0.4; filter: grayscale(100%) brightness(0.7); pointer-events: none;' : '';

    return `<div class="player player-${playerIndex}${ghostClass}"
                 style="background-image: url('${spritePath}');
                        background-size: cover;
                        background-position: center;
                        background-repeat: no-repeat;
                        ${ghostStyle}"
                 data-player-id="${playerData.id}"
                 data-player-initial="${playerInitial}"
                 data-player-alive="${playerData.alive}">${playerInitial}</div>`;
  }

  setupPlayerSprites(gameMapElement) {
    const playerElements = gameMapElement.querySelectorAll('.player');

    playerElements.forEach(playerElement => {
      const playerInitial = playerElement.getAttribute('data-player-initial');
      const playerClass = Array.from(playerElement.classList).find(cls => cls.startsWith('player-'));

      if (!playerClass) return;

      const playerIndex = parseInt(playerClass.split('-')[1]);
      const spritePath = this.SPRITE_MAP[playerIndex];

      if (spritePath) {
        this.loadSpriteWithFallback(playerElement, spritePath, playerIndex, playerInitial);
      }
    });
  }



  getPooledElement(type) {
    const pool = this.entityPool[type];
    return pool && pool.length > 0 ? pool.pop() : null;
  }

  returnToPool(element, type) {
    if (element && this.entityPool[type]) {
      element.className = '';
      element.textContent = '';
      element.removeAttribute('data-powerup-id');
      element.style.transform = '';
      
      this.entityPool[type].push(element);
    }
  }

  cleanupRemovedElements() {
    ['powerUps', 'bombs', 'players'].forEach(type => {
      const pool = this.entityPool[type];
      if (pool.length > 20) { 
        this.entityPool[type] = pool.slice(0, 20);
      }
    });
  }


  getPowerUpEmoji(powerUpType) {
    return this.POWER_UP_EMOJIS[powerUpType] || '💎';
  }


  setInvalidMoveTime(time) {
    this.lastInvalidMoveTime = time;
  }

  setInvalidMove(move) {
    this.lastInvalidMove = move;
  }

  showExplosionEffect(position, explosions, _range = 1, chainDepth = 0) {
    console.log(`💥 SHOWING EXPLOSION at (${position.x}, ${position.y}) with ${explosions.length} affected cells - Chain depth: ${chainDepth}`);

    const gameMap = this.framework.find('#game-map');
    if (!gameMap) {
      console.error('❌ Game map element not found for explosion animation');
      return;
    }

    console.log('✅ Game map found:', gameMap);
    console.log('📍 Explosion cells:', explosions);

    explosions.forEach((cell) => {
      const type = (cell.x === position.x && cell.y === position.y) ? 'center' : 'blast';
      console.log(`🎆 Creating ${type} explosion at (${cell.x}, ${cell.y}) - Chain depth: ${chainDepth}`);


      const delay = chainDepth > 0 ? chainDepth * 50 : 0;

      setTimeout(() => {
        this.createExplosionAnimation(cell.x, cell.y, type, chainDepth);
      }, delay);
    });

    const cleanupDelay = 900 + (chainDepth * 50);
    setTimeout(() => {
      console.log(`🧹 Cleaning up explosion animations for chain depth ${chainDepth}`);
      this.cleanupExplosionAnimations();
    }, cleanupDelay);
  }

  createExplosionAnimation(x, y, type = 'blast', chainDepth = 0) {
    console.log(`🎯 Creating ${type} explosion animation at (${x}, ${y}) - Chain depth: ${chainDepth}`);

    const gameMap = this.framework.find('#game-map');
    if (!gameMap) {
      console.error('❌ Game map not found in createExplosionAnimation');
      return;
    }

    const cellSelector = `[data-x="${x}"][data-y="${y}"]`;
    console.log(`🔍 Looking for cell with selector: ${cellSelector}`);

    const cellElement = this.framework.find(cellSelector);
    if (!cellElement) {
      console.error(`❌ Cell element not found for explosion at (${x}, ${y})`);
      console.log('Available cells:', this.framework.findAll('[data-x][data-y]').length);
 
      const allCells = this.framework.findAll('[data-x][data-y]');
      console.log('First 5 cells:', Array.from(allCells).slice(0, 5).map(cell => ({
        x: cell.getAttribute('data-x'),
        y: cell.getAttribute('data-y')
      })));
      return;
    }

    console.log(`✅ Found cell element for (${x}, ${y}):`, cellElement);

    const explosionElement = this.framework.createElement('div', {
      'data-explosion': 'true',
      'data-chain-depth': chainDepth.toString(),
      className: type === 'center' 
        ? `explosion-effect explosion-center ${chainDepth > 0 ? 'chain-reaction' : ''}`
        : `explosion-effect explosion-blast ${chainDepth > 0 ? 'chain-reaction' : ''}`,
      textContent: type === 'center' ? '💥' : '🔥',
      style: `
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
        animation: bomberman-explosion-pop 0.8s ease-out;
        text-shadow:
          0 0 15px rgba(255, 107, 53, 1),
          0 0 25px rgba(255, 69, 0, 0.8),
          0 0 35px rgba(255, 140, 0, 0.6);
      `
    });

    cellElement.style.position = 'relative';
    this.framework.appendChild(cellElement, explosionElement);

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
    const explosionElements = this.framework.findAll('[data-explosion="true"]');
    explosionElements.forEach(element => {
      element.classList.add('explosion-fade-out');
      setTimeout(() => {
        if (element.parentNode) {
          this.framework.removeChild(element.parentNode, element);
        }
      }, 300);
    });
    console.log(`Cleaned up ${explosionElements.length} explosion animations`);
  }

  animatePowerUpSpawn(powerUpId) {
    const el = this.framework.find(`[data-powerup-id="${powerUpId}"]`);
    if (el) {
      el.classList.add('spawning');
      setTimeout(() => el.classList.remove('spawning'), 600);
    }
  }

  animatePowerUpCollected(powerUpId) {
    const el = this.framework.find(`[data-powerup-id="${powerUpId}"]`);
    if (el) {
      el.classList.add('collected');
      setTimeout(() => {
        if (el.parentNode) {
          this.framework.removeChild(el.parentNode, el);
        }
      }, 500);
    }
  }
}