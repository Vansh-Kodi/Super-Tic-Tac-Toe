const STORAGE_KEY = 'supertictactoe_games'

export function getSavedGames() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveGame(gameState) {
  const games = getSavedGames()
  const idx = games.findIndex(g => g.id === gameState.id)
  const entry = { ...gameState, updatedAt: Date.now() }
  if (idx >= 0) {
    games[idx] = entry
  } else {
    games.push(entry)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

export function getGameById(id) {
  const games = getSavedGames()
  return games.find(g => g.id === id) ?? null
}

export function removeGame(id) {
  const games = getSavedGames().filter(g => g.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}
