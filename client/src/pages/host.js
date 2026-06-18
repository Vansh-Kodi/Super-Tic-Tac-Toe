import { GameController } from '../game/controller.js'

const STORAGE_KEY = 'player_name'

export function render() {
  const savedName = localStorage.getItem(STORAGE_KEY) || ''

  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="page">
      <div class="card">
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
      const roomCode = data.room_code

      const app = document.getElementById('app')
      new GameController(app, {
        roomCode,
        playerName: name,
        isHost: true,
      })
    } catch {
      submitBtn.disabled = false
      submitBtn.textContent = 'Create Room'
      alert('Failed to create room. Make sure the server is running.')
    }
  })
}
