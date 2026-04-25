import { defineConfig } from 'vitepress'

// GitHub Pages serves this site from https://<user>.github.io/prezl/ so
// base has to match the repo name. Override with PREZL_DOCS_BASE in CI
// if the repo is ever renamed.
const base = process.env.PREZL_DOCS_BASE ?? '/prezl/'

export default defineConfig({
  base,
  title: 'Prezl',
  description: 'Staged, IDE-like code presentations',
  lang: 'en-US',
  cleanUrls: true,
  srcExclude: ['internal/**', 'README.md'],
  lastUpdated: true,
  appearance: 'force-dark',
  head: [
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    [
      'link',
      { rel: 'icon', type: 'image/svg+xml', href: `${base}logo-pretzel2.svg` },
    ],
  ],
  themeConfig: {
    logo: { src: '/logo-pretzel2.svg', width: 28, height: 28 },
    siteTitle: 'Prezl',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/reference/yaml-schema' },
      {
        text: 'GitHub',
        link: 'https://github.com/mattbrailsford/prezl',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Prezl?', link: '/guide/getting-started' },
            { text: 'Project structure', link: '/guide/project-structure' },
            { text: 'Stages (branches)', link: '/guide/stages' },
          ],
        },
        {
          text: 'Authoring',
          items: [
            { text: 'Directives', link: '/guide/directives' },
            { text: 'Symbol navigation', link: '/guide/symbol-navigation' },
            { text: 'Previews', link: '/guide/previews' },
            { text: 'Multi-project layout', link: '/guide/multi-project' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'prezl.yaml schema', link: '/reference/yaml-schema' },
            { text: 'Directive grammar', link: '/reference/directive-grammar' },
            { text: 'Keyboard shortcuts', link: '/reference/keyboard-shortcuts' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mattbrailsford/prezl' },
    ],
    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © Matt Brailsford',
    },
    editLink: {
      pattern:
        'https://github.com/mattbrailsford/prezl/edit/dev/docs/:path',
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
  },
})
