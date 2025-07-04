/**
 * Game Screen Component for Bomberman DOM Game
 * Main game interface with board, players, and UI elements
 */

import { GameConfig } from '../core/config.js';

export function GameScreen(framework, state, actionHandler) {
  const { gameData, playerNickname } = state;
  
  if (!gameData) {
    return framework.div({ class: 'game-loading' }, [
      framework.div({ class: 'loading-spinner' }),
      framework.p({}, 'Loading game...')
    ]);
  }
  
  const { board, player, timeRemaining } = gameData;
  
  const handleBackToMenu = () => {
    if (confirm('Are you sure you want to go back to the menu?')) {
      actionHandler('back-to-menu');
    }
  };
  
  return framework.div({ class: 'game-container' }, [
    // Main Game Area
    framework.div({ class: 'game-area' }, [
      // Game Board
      framework.div({
        class: 'game-board',
        id: 'game-board'
      }, renderGameBoard(framework, board, player)),
      
      // Game Controls Overlay (for mobile)
      framework.div({ 
        class: 'game-controls mobile-only',
        style: `
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: none;
        `
      }, [
        framework.div({ class: 'control-pad' }, [
          framework.button({ 
            class: 'control-btn up',
            onclick: () => actionHandler('player-move', { direction: 'up' })
          }, '↑'),
          
          framework.div({ class: 'control-row' }, [
            framework.button({ 
              class: 'control-btn left',
              onclick: () => actionHandler('player-move', { direction: 'left' })
            }, '←'),
            
            framework.button({ 
              class: 'control-btn bomb',
              onclick: () => actionHandler('place-bomb')
            }, '💣'),
            
            framework.button({ 
              class: 'control-btn right',
              onclick: () => actionHandler('player-move', { direction: 'right' })
            }, '→')
          ]),
          
          framework.button({ 
            class: 'control-btn down',
            onclick: () => actionHandler('player-move', { direction: 'down' })
          }, '↓')
        ])
      ])
    ]),
    
    // Game Sidebar
    framework.div({ class: 'game-sidebar' }, [
      // Game Timer
      framework.div({ class: 'game-timer' }, [
        framework.div({ 
          style: 'font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 4px;'
        }, 'Time Remaining'),
        framework.div({ 
          style: `
            font-size: 2rem;
            color: ${timeRemaining < 60000 ? 'var(--error-color)' : 'var(--accent-color)'};
          `
        }, formatTime(timeRemaining))
      ]),
      
      // Player Info
      framework.div({ class: 'player-info' }, [
        framework.h3({
          style: 'margin-bottom: var(--spacing-md); color: var(--accent-color);'
        }, 'Player'),

        framework.div({
          class: 'current-player-info',
          style: 'border-left-color: var(--accent-color); background: var(--primary-color); color: white;'
        }, [
          framework.div({ class: 'player-header' }, [
            framework.div({
              class: 'player-avatar-small',
              style: `
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: var(--player-1-color);
                border: 2px solid white;
                margin-right: 8px;
              `
            }),

            framework.div({ class: 'player-name' }, player ? player.nickname : playerNickname)
          ]),

          framework.div({ class: 'player-stats' }, [
            // Lives
            framework.div({ class: 'stat-item' }, [
              framework.span({}, 'Lives:'),
              framework.div({ class: 'lives-indicator' },
                Array.from({ length: GameConfig.PLAYER_LIVES }, (_, i) =>
                  framework.div({
                    class: `life ${i >= (player?.lives || GameConfig.PLAYER_LIVES) ? 'lost' : ''}`
                  })
                )
              )
            ]),

            // Power-ups (future implementation)
            framework.div({ class: 'stat-item' }, [
              framework.span({}, 'Bombs:'),
              framework.span({
                style: 'color: var(--accent-color); font-weight: bold;'
              }, player?.bombCapacity || 1)
            ]),

            framework.div({ class: 'stat-item' }, [
              framework.span({}, 'Range:'),
              framework.span({
                style: 'color: var(--accent-color); font-weight: bold;'
              }, player?.bombRange || 1)
            ]),

            framework.div({ class: 'stat-item' }, [
              framework.span({}, 'Score:'),
              framework.span({
                style: 'color: var(--accent-color); font-weight: bold;'
              }, player?.score || 0)
            ])
          ]),

          // Player Status
          framework.div({
            class: `player-status ${player?.status || 'alive'}`,
            style: `
              margin-top: 8px;
              padding: 4px 8px;
              border-radius: var(--radius-sm);
              font-size: 0.8rem;
              text-align: center;
              background: ${getPlayerStatusBackground(player?.status || 'alive')};
              color: white;
            `
          }, getPlayerStatusText(player?.status || 'alive'))
        ])
      ]),
      
      // Game Controls Info
      framework.div({ 
        class: 'controls-info',
        style: `
          margin-top: var(--spacing-lg);
          padding: var(--spacing-md);
          background: var(--background-color);
          border-radius: var(--radius-md);
        `
      }, [
        framework.h4({ 
          style: 'margin-bottom: var(--spacing-sm); color: var(--accent-color);'
        }, 'Controls'),
        
        framework.div({ class: 'control-list' }, [
          framework.div({ 
            class: 'control-item',
            style: 'display: flex; justify-content: space-between; margin-bottom: 4px;'
          }, [
            framework.span({}, 'Move:'),
            framework.span({ 
              style: 'font-family: monospace; color: var(--text-secondary);'
            }, 'Arrow Keys')
          ]),
          
          framework.div({ 
            class: 'control-item',
            style: 'display: flex; justify-content: space-between; margin-bottom: 4px;'
          }, [
            framework.span({}, 'Bomb:'),
            framework.span({ 
              style: 'font-family: monospace; color: var(--text-secondary);'
            }, 'Space')
          ]),
          
          framework.div({ 
            class: 'control-item',
            style: 'display: flex; justify-content: space-between;'
          }, [
            framework.span({}, 'Menu:'),
            framework.span({ 
              style: 'font-family: monospace; color: var(--text-secondary);'
            }, 'Escape')
          ])
        ])
      ]),
      
      // Back to Menu Button
      framework.div({
        style: 'margin-top: auto; padding-top: var(--spacing-lg);'
      }, [
        framework.button({
          class: 'back-to-menu-button btn btn-error full-width',
          onclick: handleBackToMenu
        }, 'Back to Menu')
      ])
    ])
  ]);
}

function renderGameBoard(framework, board, player) {
  if (!board || !Array.isArray(board)) {
    return [framework.div({}, 'Loading board...')];
  }

  const cells = [];

  for (let y = 0; y < GameConfig.BOARD_HEIGHT; y++) {
    for (let x = 0; x < GameConfig.BOARD_WIDTH; x++) {
      const cellData = board[y] && board[y][x] ? board[y][x] : { type: 'empty' };
      const cellElement = renderCell(framework, x, y, cellData, player);
      cells.push(cellElement);
    }
  }

  return cells;
}

function renderCell(framework, x, y, cellData, player) {
  const { type, content } = cellData;

  const cellClasses = ['cell', type];
  const cellStyle = `
    grid-column: ${x + 1};
    grid-row: ${y + 1};
    position: relative;
  `;

  const cellContent = [];

  // Add cell background based on type
  if (type === 'wall') {
    cellClasses.push('wall');
  } else if (type === 'block') {
    cellClasses.push('block');
  }

  // Add content (bombs, explosions, power-ups) - future implementation
  if (content) {
    if (content.type === 'bomb') {
      cellContent.push(
        framework.div({
          class: 'bomb',
          style: `animation-duration: ${content.timeLeft}ms;`
        })
      );
    } else if (content.type === 'explosion') {
      cellContent.push(
        framework.div({
          class: `explosion ${content.direction || 'center'}`
        })
      );
    } else if (content.type === 'powerup') {
      cellContent.push(
        framework.div({
          class: `powerup ${content.powerupType}`
        })
      );
    }
  }

  // Add player at this position
  if (player && player.x === x && player.y === y) {
    cellContent.push(
      framework.div({
        class: `player player-1 ${player.status === 'dead' ? 'dead' : ''}`,
        style: 'z-index: 10;'
      })
    );
  }

  return framework.div({
    class: cellClasses.join(' '),
    style: cellStyle,
    'data-x': x,
    'data-y': y
  }, cellContent);
}

// Helper functions
function formatTime(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getPlayerStatusBackground(status) {
  switch (status) {
    case 'alive':
      return '#4caf50'; // Green
    case 'dead':
      return '#f44336'; // Red
    case 'respawning':
      return '#ff9800'; // Orange
    case 'disconnected':
      return '#9e9e9e'; // Gray
    default:
      return '#2196f3'; // Blue
  }
}

function getPlayerStatusText(status) {
  switch (status) {
    case 'alive':
      return 'Alive';
    case 'dead':
      return 'Dead';
    case 'respawning':
      return 'Respawning';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Unknown';
  }
}
