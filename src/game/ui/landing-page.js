/**
 * Landing Page Component for Bomberman DOM Game
 * Handles nickname entry and game joining
 */

import { GameConfig } from '../core/config.js';

export function LandingPage(framework, state, actionHandler) {
  const { playerNickname } = state;
  
  const handleNicknameSubmit = (event) => {
    console.log('Form submit handler called', event);
    event.preventDefault();

    const formData = new FormData(event.target);
    const nickname = formData.get('nickname');
    console.log('Nickname from form:', nickname);

    if (!nickname) {
      console.error('No nickname found in form data');
      showValidationError('Please enter a nickname');
      return;
    }

    const trimmedNickname = nickname.trim();
    console.log('Trimmed nickname:', trimmedNickname);

    // Validate nickname
    const validation = validateNickname(trimmedNickname);
    if (!validation.isValid) {
      console.log('Validation failed:', validation.error);
      showValidationError(validation.error);
      return;
    }

    // Clear any existing errors
    clearValidationErrors();

    console.log('Starting single-player game with nickname:', trimmedNickname);
    // Trigger start game action
    actionHandler('start-game', { nickname: trimmedNickname });
  };
  
  const validateNickname = (nickname) => {
    if (!nickname) {
      return { isValid: false, error: 'Please enter a nickname' };
    }
    
    if (nickname.length < GameConfig.VALIDATION.NICKNAME_MIN_LENGTH) {
      return { 
        isValid: false, 
        error: `Nickname must be at least ${GameConfig.VALIDATION.NICKNAME_MIN_LENGTH} characters` 
      };
    }
    
    if (nickname.length > GameConfig.VALIDATION.NICKNAME_MAX_LENGTH) {
      return { 
        isValid: false, 
        error: `Nickname must be no more than ${GameConfig.VALIDATION.NICKNAME_MAX_LENGTH} characters` 
      };
    }
    
    if (!GameConfig.VALIDATION.NICKNAME_PATTERN.test(nickname)) {
      return { 
        isValid: false, 
        error: 'Nickname can only contain letters, numbers, underscores, and hyphens' 
      };
    }
    
    return { isValid: true };
  };
  
  const showValidationError = (message) => {
    // Remove existing error
    const existingError = document.querySelector('.nickname-error');
    if (existingError) {
      existingError.remove();
    }
    
    // Create new error element
    const errorElement = document.createElement('div');
    errorElement.className = 'nickname-error error-message';
    errorElement.textContent = message;
    
    // Insert after the form
    const form = document.querySelector('.nickname-form');
    if (form) {
      form.appendChild(errorElement);
    }
  };
  
  const clearValidationErrors = () => {
    const errorElement = document.querySelector('.nickname-error');
    if (errorElement) {
      errorElement.remove();
    }
  };
  
  // Single player mode - no connection status needed
  
  return framework.div({ class: 'landing-page' }, [
    // Game Title
    framework.h1({ class: 'game-title' }, 'BOMBERMAN'),
    
    // Subtitle
    framework.p({
      class: 'game-subtitle',
      style: 'font-size: 1.2rem; color: var(--text-secondary); margin-bottom: 2rem;'
    }, 'Single Player DOM Edition'),
    
    // Nickname Form
    framework.createElement('form', {
      class: 'nickname-form',
      onsubmit: handleNicknameSubmit
    }, [
      framework.h2({ 
        style: 'margin-bottom: 1rem; color: var(--accent-color);' 
      }, 'Enter Your Nickname'),
      
      framework.input({
        type: 'text',
        name: 'nickname',
        class: 'nickname-input input',
        placeholder: 'Your nickname...',
        value: playerNickname || '',
        maxlength: GameConfig.VALIDATION.NICKNAME_MAX_LENGTH,
        required: true,
        autofocus: true,
        onchange: (e) => console.log('Input changed:', e.target.value),
        oninput: (e) => console.log('Input event:', e.target.value)
      }),
      
      framework.button({
        type: 'submit',
        class: 'start-button btn btn-primary'
      }, 'Start Game'),
      
      // Game Rules
      framework.div({ 
        class: 'game-rules',
        style: `
          margin-top: 2rem;
          padding: 1rem;
          background: var(--surface-color);
          border-radius: var(--radius-md);
          border-left: 4px solid var(--primary-color);
        `
      }, [
        framework.h3({ 
          style: 'margin-bottom: 1rem; color: var(--accent-color);' 
        }, 'How to Play'),
        
        framework.ul({ 
          style: 'list-style: none; padding: 0;' 
        }, [
          framework.li({ 
            style: 'margin-bottom: 0.5rem; padding-left: 1rem; position: relative;'
          }, [
            framework.span({ 
              style: `
                position: absolute;
                left: 0;
                color: var(--primary-color);
                font-weight: bold;
              `
            }, '•'),
            'Use arrow keys to move your player'
          ]),
          
          framework.li({ 
            style: 'margin-bottom: 0.5rem; padding-left: 1rem; position: relative;'
          }, [
            framework.span({ 
              style: `
                position: absolute;
                left: 0;
                color: var(--primary-color);
                font-weight: bold;
              `
            }, '•'),
            'Press SPACE to place bombs'
          ]),
          
          framework.li({ 
            style: 'margin-bottom: 0.5rem; padding-left: 1rem; position: relative;'
          }, [
            framework.span({ 
              style: `
                position: absolute;
                left: 0;
                color: var(--primary-color);
                font-weight: bold;
              `
            }, '•'),
            'Destroy blocks to find power-ups'
          ]),
          
          framework.li({ 
            style: 'margin-bottom: 0.5rem; padding-left: 1rem; position: relative;'
          }, [
            framework.span({ 
              style: `
                position: absolute;
                left: 0;
                color: var(--primary-color);
                font-weight: bold;
              `
            }, '•'),
            'Avoid explosions and eliminate other players'
          ]),
          
          framework.li({ 
            style: 'padding-left: 1rem; position: relative;'
          }, [
            framework.span({ 
              style: `
                position: absolute;
                left: 0;
                color: var(--primary-color);
                font-weight: bold;
              `
            }, '•'),
            'Last player standing wins!'
          ])
        ])
      ]),
      
      // Game Info
      framework.div({ 
        class: 'game-info',
        style: `
          margin-top: 1rem;
          padding: 1rem;
          background: var(--background-color);
          border-radius: var(--radius-md);
          text-align: center;
        `
      }, [
        framework.p({
          style: 'margin-bottom: 0.5rem; color: var(--text-secondary);'
        }, 'Single player • DOM-based gameplay'),

        framework.p({
          style: 'margin: 0; color: var(--text-secondary); font-size: 0.9rem;'
        }, 'Navigate with arrow keys, place bombs with spacebar')
      ])
    ])
  ]);
}

// Helper functions removed - single player mode
