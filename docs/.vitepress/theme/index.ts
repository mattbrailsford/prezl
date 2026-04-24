import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import PrezlHero from './PrezlHero.vue'
import './custom.css'

// Extend the default theme: swap in our PrezlHero component for the home
// page's hero-image slot. Everything else (sidebar, search, dark mode,
// doc footer nav, etc.) stays inherited from DefaultTheme.
export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(PrezlHero),
    }),
} satisfies Theme
