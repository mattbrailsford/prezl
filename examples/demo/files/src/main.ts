import { bootstrap } from './framework'
import { registerDashboard } from './dashboard'

function start(): void {
  const app = bootstrap({
    section: 'content',
    mode: 'presentation',
  })

  registerDashboard(app)

  app.run()
}

start()
