import { GameController } from '../game/controller.js'
import { verifyState } from '../game/logic.js'
import { getGameById } from '../storage.js'

const STORAGE_KEY = 'player_name'

export function render() {
  const savedName = localStorage.getItem(STORAGE_KEY) || ''
  const params = new URLSearchParams(window.location.search)
  const prefilledCode = (params.get('room') || '').toUpperCase()
  const continueGameId = params.get('continue')

  if (continueGameId) {
    const saved = getGameById(continueGameId)
    if (saved && saved.state && verifyState(saved.state)) {
      const app = document.getElementById('app')
      app.innerHTML = '<div class="page"><div class="card"><p class="empty-state">Creating room...</p></div></div>'
      fetch('/api/v1/rooms', { method: 'POST' })
        .then(r => r.json())
        .then(data => {
          new GameController(app, {
            roomCode: data.room_code,
            playerName: savedName || 'Player',
            isHost: true,
            loadedGame: saved,
          })
        })
        .catch(() => {
          app.innerHTML = '<div class="page"><div class="card"><p class="empty-state">Failed to create room. Is the server running?</p><a href="/" data-link class="back-link">Back to home</a></div></div>'
        })
      return
    } else {
      document.getElementById('app').innerHTML = '<div class="page"><div class="card"><p class="empty-state">Save not found or corrupted.</p><a href="/" data-link class="back-link">Back to home</a></div></div>'
      return
    }
  }

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <div class="card">
        <h1 class="card-title">Join a Game</h1>
        <form id="join-form" class="form">
          <div class="form-group">
            <label for="name">Your Name</label>
            <input type="text" id="name" name="name" placeholder="Enter your name" value="${savedName}" required />
          </div>
          <div class="form-group">
            <label for="code">Room Code</label>
            <input
              type="text"
              id="code"
              name="code"
              placeholder="ABCD"
              maxlength="4"
              value="${prefilledCode}"
              style="text-transform: uppercase; letter-spacing: 0.3em; font-weight: 600;"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary btn-full">Join</button>
        </form>
        <a href="/" data-link class="back-link">Back to home</a>
      </div>
    </div>
  `

  document.getElementById('join-form').addEventListener('submit', (e) => {
    e.preventDefault()
    const name = document.getElementById('name').value.trim()
    const code = document.getElementById('code').value.trim().toUpperCase()
    if (!name || !code) return

    localStorage.setItem(STORAGE_KEY, name)

    const app = document.getElementById('app')
    new GameController(app, {
      roomCode: code,
      playerName: name,
      isHost: false,
    })
  })
}
