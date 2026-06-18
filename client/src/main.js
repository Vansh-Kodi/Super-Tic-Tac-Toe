import { register, init } from './router.js'
import { render as renderHome } from './pages/home.js'
import { render as renderJoin } from './pages/join.js'
import { render as renderHost } from './pages/host.js'

register('/', renderHome)
register('/join', renderJoin)
register('/host', renderHost)

init()
