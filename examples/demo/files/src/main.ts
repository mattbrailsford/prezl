import { bootstrap } from './framework'
// @prezl show=[shell...]
import { registerDashboard } from './dashboard'
// @prezl end

function start(): void {
  const app = bootstrap({
    section: 'content',
    mode: 'presentation',
  })

  // @prezl show=[shell...] focus=[shell]
  registerDashboard(app)
  
  // @prezl end
  app.run()
}

start()
