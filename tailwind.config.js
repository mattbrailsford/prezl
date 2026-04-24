/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--color-app) / <alpha-value>)',
        'app-surface': 'rgb(var(--color-app-surface) / <alpha-value>)',
        'app-panel': 'rgb(var(--color-app-panel) / <alpha-value>)',
        'app-border': 'rgb(var(--color-app-border) / <alpha-value>)',
        'app-muted': 'rgb(var(--color-app-muted) / <alpha-value>)',
        'app-accent': 'rgb(var(--color-app-accent) / <alpha-value>)',
        'project-accent': 'rgb(var(--color-project-accent) / <alpha-value>)',
        focus: 'rgb(var(--color-focus) / <alpha-value>)',
      },
      textColor: {
        app: 'rgb(var(--color-text) / <alpha-value>)',
        'app-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
