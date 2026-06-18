import { getSavedGames } from '../storage.js'

export function render() {
  const savedGames = getSavedGames()

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="home">
      <section class="home-main">
        <div class="button-group">
          <a href="/join" data-link class="btn btn-primary">Join a Game</a>
          <a href="/host" data-link class="btn btn-secondary">Host a Game</a>
        </div>
      </section>
      <section class="home-continue">
        <h2>Continue a Game</h2>
        ${
          savedGames.length > 0
            ? `
        <div class="game-list">
          ${savedGames
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(
              (game) => `
            <a href="/join?continue=${encodeURIComponent(game.id)}" data-link class="game-row">
              <span class="game-name">${game.name || 'Untitled Game'}</span>
              <span class="game-date">${new Date(game.updatedAt).toLocaleString()}</span>
            </a>
          `
            )
            .join('')}
        </div>
        `
            : '<p class="empty-state">No saved games yet</p>'
        }
      </section>
    </div>
  `
}
