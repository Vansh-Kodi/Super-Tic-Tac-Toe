import { createInitialState, makeMove, verifyState } from './logic.js'
import { saveGame } from '../storage.js'
import { navigate } from '../router.js'

const INACTIVITY_MS = 120000

export class GameController {
  constructor(container, opts) {
    this.container = container
    this.roomCode = opts.roomCode
    this.playerName = opts.playerName
    this.isHost = opts.isHost || false
    this.loadedGame = opts.loadedGame || null

    this.ws = null
    this.state = null
    this.symbol = null
    this.opponentName = null
    this.lastActivity = Date.now()
    this.timer = null
    this.gameId = null
    this.finished = false

    if (this.loadedGame) {
      this.resumeFromSave(this.loadedGame)
    } else {
      this.connect()
    }
  }

  // --- WebSocket ---

  connect() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/api/v1/ws/${this.roomCode}`
    this.ws = new WebSocket(url)
    this.wsOpened = false

    const connTimeout = setTimeout(() => {
      if (!this.wsOpened && !this.finished) {
        this.finished = true
        this.ws.close()
        this.renderServerError()
      }
    }, 5000)

    this.ws.onopen = () => {
      clearTimeout(connTimeout)
      this.wsOpened = true
      if (this.loadedGame) {
        this.ws.send(JSON.stringify({
          type: 'continue',
          name: this.playerName,
          state: this.loadedGame.state,
        }))
      } else {
        this.ws.send(JSON.stringify({ type: 'join', name: this.playerName }))
      }
    }

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      this.onMessage(msg)
    }

    this.ws.onerror = () => {
      clearTimeout(connTimeout)
    }

    this.ws.onclose = () => {
      clearTimeout(connTimeout)
      if (!this.finished) {
        this.stopTimer()
        this.renderDisconnected()
      }
    }
  }

  onMessage(msg) {
    switch (msg.type) {
      case 'assigned':
        this.symbol = msg.symbol
        if (this.isHost) {
          this.renderLobby()
        }
        break

      case 'opponent_joined':
        this.opponentName = msg.name
        if (this.isHost) {
          this.renderLobby()
        }
        break

      case 'game_start': {
        this.symbol = msg.symbol
        this.opponentName = msg.opponent
        this.gameId = `game_${this.roomCode}_${Date.now()}`
        if (msg.state) {
          this.state = msg.state
          if (!verifyState(this.state)) {
            this.renderTampered()
            return
          }
        } else {
          this.state = createInitialState(
            msg.symbol === 'X' ? this.playerName : msg.opponent,
            msg.symbol === 'X' ? msg.opponent : this.playerName,
          )
        }
        if (this.state.status === 'playing') {
          this.startTimer()
        }
        this.render()
        break
      }

      case 'move':
        if (msg.state) {
          this.state = msg.state
          if (!verifyState(this.state)) {
            this.renderTampered()
            return
          }
          this.resetTimer()
          if (this.state.status === 'finished') {
            this.stopTimer()
            this.saveCurrentGame()
          }
          this.render()
        }
        break

      case 'save_game':
        this.saveCurrentGame()
        this.showToast('Game saved!')
        break

      case 'opponent_disconnected':
        this.stopTimer()
        this.saveCurrentGame()
        this.finished = true
        if (this.ws) {
          this.ws.close()
        }
        this.renderOpponentLeft()
        break
    }
  }

  // --- Game actions ---

  makeMove(boardIdx, cellIdx) {
    if (!this.state || this.state.status !== 'playing') return
    if (this.state.currentPlayer !== this.symbol) return

    const next = makeMove(this.state, boardIdx, cellIdx)
    if (!next) return

    this.state = next
    this.resetTimer()

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'move', state: this.state }))
    }

    if (this.state.status === 'finished') {
      this.stopTimer()
      this.saveCurrentGame()
    }

    this.render()
  }

  saveCurrentGame() {
    if (!this.gameId) {
      this.gameId = `game_${this.roomCode}_${Date.now()}`
    }
    saveGame({
      id: this.gameId,
      name: `vs ${this.opponentName || '?'}`,
      state: this.state,
      roomCode: this.roomCode,
      updatedAt: Date.now(),
    })
  }

  doSaveGame() {
    this.saveCurrentGame()
    this.showToast('Game saved!')
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'save_game' }))
    }
  }

  leaveGame() {
    this.stopTimer()
    this.finished = true
    if (this.ws) {
      this.ws.close()
    }
    navigate('/')
  }

  // --- Inactivity ---

  resetTimer() {
    this.lastActivity = Date.now()
  }

  startTimer() {
    this.stopTimer()
    this.lastActivity = Date.now()
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.lastActivity
      const left = Math.max(0, INACTIVITY_MS - elapsed)
      this.updateTimerDisplay(left)
      if (left === 0) {
        this.stopTimer()
        this.saveCurrentGame()
        this.finished = true
        if (this.ws) this.ws.close()
        this.renderAutoSaved()
      }
    }, 500)
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  updateTimerDisplay(left) {
    const el = document.getElementById('inactivity-timer')
    if (!el) return
    const secs = Math.ceil(left / 1000)
    const m = Math.floor(secs / 60)
    const s = secs % 60
    el.textContent = `${m}:${s.toString().padStart(2, '0')}`
    el.style.color = left < 30000 ? 'var(--secondary)' : 'var(--text-muted)'
  }

  // --- Resume from save ---

  resumeFromSave(saved) {
    if (!verifyState(saved.state)) {
      this.renderTampered()
      return
    }
    this.state = saved.state
    this.gameId = saved.id
    this.roomCode = saved.roomCode || ''
    this.symbol = this.state.players.X === this.playerName ? 'X' : 'O'
    this.opponentName =
      this.state.players.X === this.playerName
        ? this.state.players.O
        : this.state.players.X

    if (this.state.status === 'playing') {
      this.connect()
    } else {
      this.render()
    }
  }

  // --- Rendering ---

  render() {
    this.container.innerHTML = ''
    this.container.appendChild(this.buildGameDOM())
  }

  buildGameDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'game-wrapper'

    wrapper.appendChild(this.buildHeader())
    wrapper.appendChild(this.buildBoard())

    if (this.state.status === 'playing') {
      wrapper.appendChild(this.buildFooter())
    } else {
      wrapper.appendChild(this.buildGameOver())
    }

    return wrapper
  }

  buildHeader() {
    const header = document.createElement('div')
    header.className = 'game-header'

    const pX = document.createElement('span')
    pX.className = `player-tag ${this.symbol === 'X' ? 'is-you' : ''}`
    pX.innerHTML = `<span class="player-sym x-sym">X</span> ${this.state.players.X}${this.symbol === 'X' ? ' (you)' : ''}`

    const pO = document.createElement('span')
    pO.className = `player-tag ${this.symbol === 'O' ? 'is-you' : ''}`
    pO.innerHTML = `<span class="player-sym o-sym">O</span> ${this.state.players.O}${this.symbol === 'O' ? ' (you)' : ''}`

    header.appendChild(pX)
    header.appendChild(pO)
    return header
  }

  buildBoard() {
    const board = document.createElement('div')
    board.className = 'big-board'

    const validBoards = this.getValidBoardIndices()

    for (let bi = 0; bi < 9; bi++) {
      const sb = document.createElement('div')
      sb.className = 'small-board'
      if (this.state.bigBoard[bi] !== null) {
        sb.classList.add('won')
      } else if (this.state.status === 'playing' && validBoards.includes(bi)) {
        sb.classList.add('active')
      }

      const inner = document.createElement('div')
      inner.className = 'small-inner'

      for (let ci = 0; ci < 9; ci++) {
        const cell = document.createElement('div')
        cell.className = 'cell'
        const val = this.state.boards[bi][ci]
        if (val === 'X') {
          cell.classList.add('x')
          cell.textContent = 'X'
        } else if (val === 'O') {
          cell.classList.add('o')
          cell.textContent = 'O'
        } else if (
          this.state.bigBoard[bi] === null &&
          this.state.status === 'playing' &&
          validBoards.includes(bi)
        ) {
          cell.classList.add('empty')
          cell.dataset.board = bi
          cell.dataset.cell = ci
        }

        inner.appendChild(cell)
      }

      sb.appendChild(inner)

      if (this.state.bigBoard[bi] !== null) {
        const overlay = document.createElement('div')
        overlay.className = 'board-overlay'
        const v = this.state.bigBoard[bi]
        overlay.textContent = v === 'draw' ? '=' : v
        if (v === 'X') overlay.classList.add('x')
        else if (v === 'O') overlay.classList.add('o')
        else overlay.classList.add('draw')
        sb.appendChild(overlay)
      }

      board.appendChild(sb)

      if (bi === 2 || bi === 5) {
        const br = document.createElement('br')
        br.className = 'board-break'
        board.appendChild(br)
      }
    }

    board.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell.empty')
      if (!cell) return
      const boardIdx = parseInt(cell.dataset.board)
      const cellIdx = parseInt(cell.dataset.cell)
      this.makeMove(boardIdx, cellIdx)
    })

    return board
  }

  buildFooter() {
    const footer = document.createElement('div')
    footer.className = 'game-footer'

    const turn = document.createElement('div')
    turn.className = 'turn-info'
    if (this.state.currentPlayer === this.symbol) {
      turn.innerHTML = `<span class="turn-badge ${this.symbol === 'X' ? 'x-sym' : 'o-sym'}">Your turn</span>`
    } else {
      turn.innerHTML = `<span class="turn-badge waiting">Waiting for ${this.opponentName}...</span>`
    }

    const actions = document.createElement('div')
    actions.className = 'game-actions'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'btn-small'
    saveBtn.textContent = 'Save Game'
    saveBtn.addEventListener('click', () => this.doSaveGame())

    const timer = document.createElement('span')
    timer.id = 'inactivity-timer'
    timer.className = 'inactivity-timer'
    timer.textContent = '2:00'

    const leaveBtn = document.createElement('button')
    leaveBtn.className = 'btn-small btn-danger'
    leaveBtn.textContent = 'Leave'
    leaveBtn.addEventListener('click', () => this.leaveGame())

    actions.appendChild(saveBtn)
    actions.appendChild(timer)
    actions.appendChild(leaveBtn)

    footer.appendChild(turn)
    footer.appendChild(actions)

    return footer
  }

  buildGameOver() {
    const div = document.createElement('div')
    div.className = 'game-footer'

    const msg = document.createElement('div')
    msg.className = 'turn-info'

    if (this.state.winner === 'draw') {
      msg.innerHTML = '<span class="turn-badge waiting">Game ended in a draw</span>'
    } else if (this.state.winner === this.symbol) {
      msg.innerHTML = '<span class="turn-badge x-sym">You won!</span>'
    } else {
      msg.innerHTML = `<span class="turn-badge o-sym">${this.opponentName} won</span>`
    }

    const actions = document.createElement('div')
    actions.className = 'game-actions'

    const homeBtn = document.createElement('button')
    homeBtn.className = 'btn-small'
    homeBtn.textContent = 'Back to Home'
    homeBtn.addEventListener('click', () => this.leaveGame())

    actions.appendChild(homeBtn)
    div.appendChild(msg)
    div.appendChild(actions)

    return div
  }

  getValidBoardIndices() {
    if (this.state.status !== 'playing') return []
    if (this.state.nextBoard !== null) {
      return this.state.bigBoard[this.state.nextBoard] === null
        ? [this.state.nextBoard]
        : []
    }
    return this.state.bigBoard
      .map((b, i) => (b === null ? i : null))
      .filter(i => i !== null)
  }

  // --- Special renders ---

  renderLobby() {
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Room Created</h1>
          <div class="room-code-wrapper">
            <span class="room-code-label">Room Code</span>
            <span class="room-code">${this.roomCode}</span>
          </div>
          <button class="btn btn-small btn-copy" id="copy-link-btn">Copy Join Link</button>
          <div class="lobby">
            <h2 class="lobby-title">Players</h2>
            <div class="player-list">
              <div class="player-slot player-filled">
                <span class="player-icon">●</span>
                <span class="player-name">${this.playerName} (you)</span>
              </div>
              <div class="player-slot ${this.opponentName ? 'player-filled' : 'player-empty'}">
                <span class="player-icon">${this.opponentName ? '●' : '○'}</span>
                <span class="player-name">${this.opponentName || 'Waiting for opponent...'}</span>
              </div>
            </div>
            <p class="waiting-text">${this.opponentName ? 'Opponent joined! Starting game...' : 'Waiting for opponent to join...'}</p>
          </div>
          <a href="/" class="back-link" id="back-home">Back to home</a>
        </div>
      </div>
    `

    document.getElementById('copy-link-btn').addEventListener('click', () => {
      const link = `${window.location.origin}/join?room=${this.roomCode}`
      navigator.clipboard.writeText(link).catch(() => {})
      const btn = document.getElementById('copy-link-btn')
      btn.textContent = 'Copied!'
      setTimeout(() => { btn.textContent = 'Copy Join Link' }, 2000)
    })

    document.getElementById('back-home').addEventListener('click', (e) => {
      e.preventDefault()
      this.leaveGame()
    })
  }

  renderServerError() {
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Connection Failed</h1>
          <p class="empty-state">Could not connect to the game server. Make sure the backend is running (<code>python run.py</code> from the server/ directory).</p>
          <a href="/" data-link class="btn btn-primary btn-full" style="text-decoration:none;text-align:center;">Back to Home</a>
        </div>
      </div>
    `
  }

  renderDisconnected() {
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Disconnected</h1>
          <p class="empty-state">Connection lost. You can continue from a saved game on the home page.</p>
          <a href="/" data-link class="btn btn-primary btn-full" style="text-decoration:none;text-align:center;">Back to Home</a>
        </div>
      </div>
    `
  }

  renderOpponentLeft() {
    this.finished = true
    this.saveCurrentGame()
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Opponent Left</h1>
          <p class="empty-state">${this.opponentName || 'Your opponent'} has disconnected. The game has been saved.</p>
          <a href="/" data-link class="btn btn-primary btn-full" style="text-decoration:none;text-align:center;">Back to Home</a>
        </div>
      </div>
    `
  }

  renderAutoSaved() {
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Game Saved</h1>
          <p class="empty-state">Auto-saved due to inactivity. Continue from the home page.</p>
          <a href="/" data-link class="btn btn-primary btn-full" style="text-decoration:none;text-align:center;">Back to Home</a>
        </div>
      </div>
    `
  }

  renderTampered() {
    this.finished = true
    this.container.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card-title">Save Corrupted</h1>
          <p class="empty-state">This save file appears to have been tampered with and cannot be loaded.</p>
          <a href="/" data-link class="btn btn-primary btn-full" style="text-decoration:none;text-align:center;">Back to Home</a>
        </div>
      </div>
    `
  }

  showToast(msg) {
    const el = document.createElement('div')
    el.className = 'toast'
    el.textContent = msg
    document.body.appendChild(el)
    setTimeout(() => el.classList.add('show'), 10)
    setTimeout(() => {
      el.classList.remove('show')
      setTimeout(() => el.remove(), 300)
    }, 2000)
  }
}
