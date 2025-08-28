// Build the error page with DOM text nodes so requested URLs cannot inject HTML.
export const NotFound404 = (framework) => {
  const create = (tag, attributes) => framework.createElement(tag, attributes);
  const container = create('main', { className: 'bomberman-not-found-container' });
  const content = create('div', { className: 'bomberman-not-found-content' });
  content.append(
    create('div', { className: 'bomberman-error-code', textContent: '404' }),
    create('h1', { className: 'bomberman-error-title', textContent: 'Route Exploded!' }),
    create('p', {
      className: 'bomberman-error-message',
      textContent: 'This page does not exist. Return to the arena to play.',
    }),
    create('code', { className: 'bomberman-url-code', textContent: window.location.pathname }),
    create('a', { className: 'bomberman-btn-primary', href: '/', textContent: 'Play Bomberman' }),
  );
  container.append(content);
  return container;
};
