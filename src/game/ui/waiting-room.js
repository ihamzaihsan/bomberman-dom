/**
 * Waiting Room Component for Bomberman DOM Game
 * Displays players, chat, and countdown functionality
 */

import { GameConfig } from '../core/config.js';

export function WaitingRoom(framework, state, actionHandler) {
  const { playerNickname } = state;
  
  const handleBackToMenu = () => {
    if (confirm('Are you sure you want to go back to the menu?')) {
      actionHandler('back-to-menu');
    }
  };
  
  return framework.div({ class: 'waiting-room' }, [
    // Header
    framework.div({ class: 'waiting-header' }, [
      framework.h1({ class: 'waiting-title' }, 'Preparing Game'),

      framework.div({ class: 'player-info' }, [
        framework.span({
          style: 'font-size: 1.2rem; color: var(--primary-color); font-weight: bold;'
        }, `Welcome, ${playerNickname}!`)
      ]),
      
      // Game start status
      framework.div({
        class: 'game-status',
        style: 'margin-top: 1rem;'
      }, [
        framework.div({
          class: 'status-message info',
          style: `
            padding: 8px 16px;
            background: var(--primary-color);
            color: white;
            border-radius: var(--radius-md);
            text-align: center;
          `
        }, 'Initializing game board...')
      ])
    ]),
    
    // Main Content
    framework.div({ class: 'waiting-content' }, [
      // Game Info
      framework.div({ class: 'game-info' }, [
        framework.h2({ class: 'info-title' }, 'Game Information'),

        framework.div({ class: 'info-container' }, [
          framework.div({ class: 'info-item' }, [
            framework.div({ class: 'info-label' }, 'Player:'),
            framework.div({ class: 'info-value' }, playerNickname)
          ]),

          framework.div({ class: 'info-item' }, [
            framework.div({ class: 'info-label' }, 'Game Mode:'),
            framework.div({ class: 'info-value' }, 'Single Player')
          ]),

          framework.div({ class: 'info-item' }, [
            framework.div({ class: 'info-label' }, 'Board Size:'),
            framework.div({ class: 'info-value' }, `${GameConfig.BOARD_WIDTH} × ${GameConfig.BOARD_HEIGHT}`)
          ]),

          framework.div({ class: 'info-item' }, [
            framework.div({ class: 'info-label' }, 'Lives:'),
            framework.div({ class: 'info-value' }, GameConfig.PLAYER_LIVES)
          ])
        ])
      ]),
      
      // Game Instructions
      framework.div({ class: 'instructions-container' }, [
        framework.div({ class: 'instructions-header' }, 'How to Play'),

        framework.div({ class: 'instructions-content' }, [
          framework.div({ class: 'instruction-item' }, [
            framework.div({ class: 'instruction-key' }, '↑ ↓ ← →'),
            framework.div({ class: 'instruction-text' }, 'Move your player')
          ]),

          framework.div({ class: 'instruction-item' }, [
            framework.div({ class: 'instruction-key' }, 'SPACE'),
            framework.div({ class: 'instruction-text' }, 'Place bomb (coming soon)')
          ]),

          framework.div({ class: 'instruction-item' }, [
            framework.div({ class: 'instruction-key' }, 'ESC'),
            framework.div({ class: 'instruction-text' }, 'Back to menu')
          ]),

          framework.div({ class: 'instruction-note' }, [
            framework.p({}, 'Navigate around the board using arrow keys. Avoid walls (dark brown) and destructible blocks (light brown). Your goal is to explore the board and test the movement system.')
          ])
        ])
      ])
    ]),
    
    // Footer Actions
    framework.div({
      class: 'waiting-footer',
      style: `
        padding: var(--spacing-md);
        border-top: 2px solid var(--primary-color);
        background: var(--surface-color);
        display: flex;
        justify-content: center;
        align-items: center;
      `
    }, [
      framework.button({
        class: 'back-button btn btn-secondary',
        onclick: handleBackToMenu
      }, 'Back to Menu')
    ])
  ]);
}

// Helper functions removed - single player mode
