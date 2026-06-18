const SALT = 'stt-integrity-salt-v1'

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return (h >>> 0).toString(36)
}

export function hashState(state) {
  const clean = { ...state }
  delete clean.hash
  return hash(JSON.stringify(clean) + SALT)
}

export function verifyState(state) {
  if (!state || !state.hash) return false
  const saved = state.hash
  const clean = { ...state }
  delete clean.hash
  return hash(JSON.stringify(clean) + SALT) === saved
}

export function createInitialState(playerX, playerO) {
  const state = {
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    bigBoard: Array(9).fill(null),
    currentPlayer: 'X',
    nextBoard: null,
    players: { X: playerX, O: playerO },
    status: 'playing',
    winner: null,
    moveHistory: [],
    turnNumber: 1,
  }
  state.hash = hashState(state)
  return state
}

export function checkSmallWin(cells) {
  for (const [a, b, c] of WIN_LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return cells[a]
    }
  }
  return cells.every(c => c !== null) ? 'draw' : null
}

export function checkBigWin(bigBoard) {
  for (const [a, b, c] of WIN_LINES) {
    const v = bigBoard[a]
    if (v && v !== 'draw' && v === bigBoard[b] && v === bigBoard[c]) {
      return v
    }
  }
  return null
}

export function isValidMove(state, boardIdx, cellIdx) {
  if (state.status !== 'playing') return false
  if (state.bigBoard[boardIdx] !== null) return false
  if (state.boards[boardIdx][cellIdx] !== null) return false
  if (state.nextBoard !== null && state.nextBoard !== boardIdx) return false
  return true
}

export function getValidBoards(state) {
  if (state.status !== 'playing') return []
  if (state.nextBoard !== null) {
    return state.bigBoard[state.nextBoard] === null ? [state.nextBoard] : []
  }
  return state.bigBoard
    .map((b, i) => (b === null ? i : null))
    .filter(i => i !== null)
}

export function makeMove(state, boardIdx, cellIdx) {
  if (!isValidMove(state, boardIdx, cellIdx)) return null

  const s = JSON.parse(JSON.stringify(state))
  s.boards[boardIdx][cellIdx] = s.currentPlayer

  const smallWinner = checkSmallWin(s.boards[boardIdx])
  if (smallWinner) {
    s.bigBoard[boardIdx] = smallWinner
  }

  const bigWinner = checkBigWin(s.bigBoard)
  if (bigWinner) {
    s.winner = bigWinner
    s.status = 'finished'
    s.nextBoard = null
    s.hash = hashState(s)
    return s
  }

  if (s.bigBoard.every(b => b !== null)) {
    s.status = 'finished'
    s.winner = 'draw'
    s.nextBoard = null
    s.hash = hashState(s)
    return s
  }

  const nextTarget = cellIdx
  if (s.bigBoard[nextTarget] !== null) {
    s.nextBoard = null
  } else {
    s.nextBoard = nextTarget
  }

  const available = s.bigBoard.map((b, i) => (b === null ? i : null)).filter(i => i !== null)

  if (s.nextBoard === null && available.length === 0) {
    s.status = 'finished'
    s.winner = 'draw'
    s.hash = hashState(s)
    return s
  }

  if (s.nextBoard !== null && available.length === 0) {
    s.status = 'finished'
    s.winner = 'draw'
    s.hash = hashState(s)
    return s
  }

  if (s.nextBoard === null && available.length > 0) {
    s.currentPlayer = s.currentPlayer === 'X' ? 'O' : 'X'
    s.turnNumber++
    s.moveHistory.push({ boardIdx, cellIdx, player: state.currentPlayer })
    s.hash = hashState(s)
    return s
  }

  s.currentPlayer = s.currentPlayer === 'X' ? 'O' : 'X'
  s.turnNumber++
  s.moveHistory.push({ boardIdx, cellIdx, player: state.currentPlayer })
  s.hash = hashState(s)
  return s
}
