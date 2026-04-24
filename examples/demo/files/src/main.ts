import { bootstrap } from './framework'
// @prezl:show [shell...]
import { registerDashboard } from './dashboard'
// @prezl:/show

function start(): void {
  const app = bootstrap({
    section: 'content',
    mode: 'presentation',
  })

  // @prezl:show [shell...]
  // @prezl:focus [shell]
  registerDashboard(app)
  // @prezl:/focus
  // @prezl:/show

  app.run()
}

start()
