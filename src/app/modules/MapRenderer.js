import { SPRITE_CONFIG, POWER_UP_CONFIG } from '../../shared/GameConstants.js';

export class MapRenderer {
  constructor(framework) {
    this.framework = framework;

    this.lastGameMapState = null;
    this.dirtyMapCells = new Set();
    this.lastRenderedGameState = null;
    this.lastRenderedElement = null;

    this.SPRITE_MAP = SPRITE_CONFIG.PLAYER_SPRITES;
    this.POWER_UP_EMOJIS = POWER_UP_CONFIG.EMOJIS;
    this.FALLBACK_COLORS = SPRITE_CONFIG.FALLBACK_COLORS;
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
          'data-y': y.toString(),
        });

        const playersAtPosition = Object.values(players).filter((p) => p.x === x && p.y === y);
        const bombsAtPosition = bombs.filter((b) => b.x === x && b.y === y);
        const powerUpsAtPosition = powerUps.filter((p) => p.x === x && p.y === y);

        powerUpsAtPosition.forEach((powerUp) => {
          const powerUpElement = this.createPowerUpElement(powerUp);
          this.framework.appendChild(cellElement, powerUpElement);
        });

        bombsAtPosition.forEach((bomb) => {
          const bombElement = this.createBombElement(bomb);
          this.framework.appendChild(cellElement, bombElement);
        });

        playersAtPosition.forEach((player) => {
          const playerKeys = Object.keys(players);
          const playerIndex = player.slot ?? playerKeys.indexOf(player.id);
          const playerElement = this.createPlayerElement(player, playerIndex);
          this.framework.appendChild(cellElement, playerElement);
        });

        this.framework.appendChild(mapFragment, cellElement);
      });
    });

    return mapFragment;
  }

  renderFullGameMap(gameState) {
    this.framework.clearAllCaches();
    let gameMapElement =
      this.framework.getCachedElement('game-map') || this.framework.find('#game-map');

    if (!gameMapElement) {
      setTimeout(() => {
        this.renderFullGameMap(gameState);
      }, 100);
      return;
    }

    if (!gameState) {
      return;
    }

    this.framework.cacheElement('game-map', gameMapElement);

    gameMapElement.innerHTML = '';
    gameMapElement.appendChild(this.renderGameMap(gameState));

    this.lastGameMapState = this.createMapStateSnapshot(
      gameState.map,
      gameState.players,
      gameState.bombs || [],
      gameState.powerUps || [],
    );
  }

  updateGameMapOptimized(gameState) {
    if (!gameState || !gameState.map) {
      return;
    }

    const gameMapElement =
      this.framework.getCachedElement('game-map') || this.framework.find('#game-map');

    if (!gameMapElement) {
      return;
    }

    if (gameMapElement !== this.lastRenderedElement) {
      this.renderFullGameMap(gameState);
    } else if (gameState !== this.lastRenderedGameState) {
      this.updateGameMapSelective(gameState);
    } else {
      this.framework.incrementCounter('skipped-renders-no-changes');
    }
    this.lastRenderedGameState = gameState;
    this.lastRenderedElement = gameMapElement;
  }

  updateGameMapSelective(gameState) {
    const map = gameState.map;
    const players = gameState.players;
    const bombs = gameState.bombs || [];
    const powerUps = gameState.powerUps || [];

    this.identifyDirtyCells(map, players, bombs, powerUps);

    this.processDirtyCells(map, players);
  }

  identifyDirtyCells(map, players, bombs, powerUps) {
    const currentState = this.createMapStateSnapshot(map, players, bombs, powerUps);

    if (this.lastGameMapState) {
      for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
          const cellKey = `${x}-${y}`;
          const currentCellState = currentState.get(cellKey);
          const lastCellState = this.lastGameMapState.get(cellKey);

          if (
            !lastCellState ||
            JSON.stringify(currentCellState) !== JSON.stringify(lastCellState)
          ) {
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
          players: Object.values(players).filter((p) => p.x === x && p.y === y),
          bombs: bombs.filter((b) => b.x === x && b.y === y),
          powerUps: powerUps.filter((p) => p.x === x && p.y === y),
        };
        snapshot.set(cellKey, cellState);
      }
    }

    return snapshot;
  }

  processDirtyCells(map, players) {
    const gameMapElement = this.framework.getCachedElement('game-map');
    if (!gameMapElement) return;

    this.ensureGameMapStructure(gameMapElement, map);

    this.dirtyMapCells.forEach((cellKey) => {
      const cellData = this.lastGameMapState.get(cellKey);

      this.framework.updateElement(`cell-${cellKey}`, (cellElement) => {
        this.renderCellContent(cellElement, cellData, players);
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
            id: `cell-${x}-${y}`,
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

  renderCellContent(cellElement, cellData, players) {
    this.framework.setContent(cellElement, '');

    cellElement.className = `cell ${cellData.cellType}`;

    cellData.powerUps.forEach((powerUpData) => {
      const powerUpElement = this.createPowerUpElement(powerUpData);
      this.framework.appendChild(cellElement, powerUpElement);
    });

    cellData.bombs.forEach((bombData) => {
      const bombElement = this.createBombElement(bombData);
      this.framework.appendChild(cellElement, bombElement);
    });

    cellData.players.forEach((playerData) => {
      const playerKeys = Object.keys(players);
      const playerIndex = playerData.slot ?? playerKeys.indexOf(playerData.id);
      const playerElement = this.createPlayerElement(playerData, playerIndex);
      this.framework.appendChild(cellElement, playerElement);
    });
  }

  createPowerUpElement(powerUpData) {
    const powerUpElement = this.framework.createElement('div', {
      className: `powerup powerup-${powerUpData.type}`,
      'data-powerup-id': powerUpData.id,
      textContent: this.getPowerUpEmoji(powerUpData.type),
      style: 'transform: translateZ(0)',
    });

    return powerUpElement;
  }

  createBombElement(_bombData) {
    const bombElement = this.framework.createElement('div', {
      className: 'bomb',
      textContent: '💣',
      style: 'transform: translateZ(0)',
    });

    return bombElement;
  }

  createPlayerElement(playerData, index) {
    const isGhost = !playerData.alive;
    const ghostClass = isGhost ? ' player-ghost' : '';

    const playerElement = this.framework.createElement('div', {
      className: `player player-${index}${ghostClass}`,
      textContent: playerData.nickname.charAt(0).toUpperCase(),
      style: `transform: translateZ(0);${
        isGhost
          ? 'opacity: 0.4; filter: grayscale(100%) brightness(0.7); pointer-events: none;'
          : ''
      }`,
      'data-player-id': playerData.id,
      'data-player-alive': playerData.alive,
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
    playerElement.style.backgroundImage =
      'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3) 20%, transparent 20%)';
    playerElement.style.borderRadius = '50%';
    playerElement.style.fontSize = '14px';
    playerElement.style.color = 'white';
    playerElement.style.fontWeight = 'bold';

    const playerInitial =
      typeof playerData === 'string' ? playerData : playerData.nickname.charAt(0).toUpperCase();
    playerElement.textContent = playerInitial;
  }

  getPowerUpEmoji(powerUpType) {
    return this.POWER_UP_EMOJIS[powerUpType] || '💎';
  }

  showExplosionEffect(position, explosions, _range = 1, chainDepth = 0) {
    const gameMap = this.framework.find('#game-map');
    if (!gameMap) {
      console.error('❌ Game map element not found for explosion animation');
      return;
    }

    explosions.forEach((cell) => {
      const type = cell.x === position.x && cell.y === position.y ? 'center' : 'blast';

      const delay = chainDepth > 0 ? chainDepth * 50 : 0;

      setTimeout(() => {
        this.createExplosionAnimation(cell.x, cell.y, type, chainDepth);
      }, delay);
    });

    const cleanupDelay = 900 + chainDepth * 50;
    setTimeout(() => {
      this.cleanupExplosionAnimations();
    }, cleanupDelay);
  }

  createExplosionAnimation(x, y, type = 'blast', chainDepth = 0) {
    const gameMap = this.framework.find('#game-map');
    if (!gameMap) {
      console.error('❌ Game map not found in createExplosionAnimation');
      return;
    }

    const cellSelector = `[data-x="${x}"][data-y="${y}"]`;

    const cellElement = this.framework.find(cellSelector);
    if (!cellElement) {
      console.error(`❌ Cell element not found for explosion at (${x}, ${y})`);

      return;
    }

    const explosionElement = this.framework.createElement('div', {
      'data-explosion': 'true',
      'data-chain-depth': chainDepth.toString(),
      className:
        type === 'center'
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
      `,
    });

    cellElement.style.position = 'relative';
    this.framework.appendChild(cellElement, explosionElement);
  }

  cleanupExplosionAnimations() {
    const explosionElements = this.framework.findAll('[data-explosion="true"]');
    explosionElements.forEach((element) => {
      element.classList.add('explosion-fade-out');
      setTimeout(() => {
        if (element.parentNode) {
          this.framework.removeChild(element.parentNode, element);
        }
      }, 300);
    });
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
