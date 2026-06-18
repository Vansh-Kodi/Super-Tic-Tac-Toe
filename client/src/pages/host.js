import { navigate } from '../router.js'

const STORAGE_KEY = 'player_name'
let currentRoomCode = null

export function render() {
  currentRoomCode = null
  const savedName = localStorage.getItem(STORAGE_KEY) || ''

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <div class="card" id="host-card">
        <h1 class="card-title">Host a Game</h1>
        <form id="host-form" class="form">
          <div class="form-group">
            <label for="name">Your Name</label>
            <input type="text" id="name" name="name" placeholder="Enter your name" value="${savedName}" required />
          </div>
          <button type="submit" class="btn btn-secondary btn-full">Create Room</button>
        </form>
        <a href="/" data-link class="back-link">Back to home</a>
      </div>
    </div>
  `

  document.getElementById('host-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('name').value.trim()
    if (!name) return

    localStorage.setItem(STORAGE_KEY, name)

    const submitBtn = e.target.querySelector('button[type="submit"]')
    submitBtn.disabled = true
    submitBtn.textContent = 'Creating...'

    try {
      const res = await fetch('/api/v1/rooms', { method: 'POST' })
      const data = await res.json()
      showLobby(name, data.room_code)
    } catch {
      submitBtn.disabled = false
      submitBtn.textContent = 'Create Room'
      alert('Failed to create room. Make sure the server is running.')
    }
  })
}

async function goHome() {
  if (currentRoomCode) {
    await fetch(`/api/v1/rooms/${currentRoomCode}`, { method: 'DELETE' }).catch(() => {})
  }
  navigate('/')
}

function showLobby(name, roomCode) {
  currentRoomCode = roomCode
  const card = document.getElementById('host-card')
  card.innerHTML = `
    <h1 class="card-title">Room Created</h1>
    <div class="room-code-wrapper">
      <span class="room-code-label">Room Code</span>
      <span class="room-code">${roomCode}</span>
    </div>
    <div class="lobby">
      <h2 class="lobby-title">Players</h2>
      <div class="player-list">
        <div class="player-slot player-filled">
          <span class="player-icon">●</span>
          <span class="player-name">${name} (you)</span>
        </div>
        <div class="player-slot player-empty">
          <span class="player-icon">○</span>
          <span class="player-name">Waiting for player...</span>
        </div>
        <div class="player-slot player-empty">
          <span class="player-icon">○</span>
          <span class="player-name">Waiting for player...</span>
        </div>
      </div>
      <p class="waiting-text">Waiting for players to join...</p>
      <button class="btn btn-primary btn-full" id="start-game-btn" disabled>Start Game</button>
    </div>
    <a href="/" class="back-link" id="back-home">Back to home</a>
  `

  document.getElementById('back-home').addEventListener('click', (e) => {
    e.preventDefault()
    goHome()
  })
}
