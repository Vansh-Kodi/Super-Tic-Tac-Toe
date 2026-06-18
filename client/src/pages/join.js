import { navigate } from '../router.js'

const STORAGE_KEY = 'player_name'

export function render() {
  const savedName = localStorage.getItem(STORAGE_KEY) || ''

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
    if (name && code) {
      localStorage.setItem(STORAGE_KEY, name)
      navigate(`/game/join?room=${code}&name=${encodeURIComponent(name)}`)
    }
  })
}
