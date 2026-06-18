const routes = {}

export function register(path, handler) {
  routes[path] = handler
}

export function navigate(path) {
  history.pushState(null, null, path)
  handleRoute()
}

function handleRoute() {
  const path = window.location.pathname
  const handler = routes[path] || routes['*']
  if (handler) handler(path)
}

export function init() {
  window.addEventListener('popstate', handleRoute)

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]')
    if (link) {
      e.preventDefault()
      navigate(link.getAttribute('href'))
    }
  })

  handleRoute()
}
