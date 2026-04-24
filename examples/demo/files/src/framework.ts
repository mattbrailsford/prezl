type BootstrapOptions = {
  section: string
  mode: 'presentation' | 'editing'
}

export type App = {
  run(): void
  dashboards: {
    add(dashboard: {
      id: string
      title: string
      render(container: HTMLElement): void | Promise<void>
    }): void
  }
}

export function bootstrap(_options: BootstrapOptions): App {
  const dashboards: Array<{
    id: string
    title: string
    render(container: HTMLElement): void | Promise<void>
  }> = []
  return {
    run() {
      /* scaffolded out for presentation purposes */
    },
    dashboards: {
      add(dashboard) {
        dashboards.push(dashboard)
      },
    },
  }
}
