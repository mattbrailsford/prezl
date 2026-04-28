import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const suffix = Math.floor(Date.now() / 1000)
const stamped = `${pkg.version}-dev.${suffix}`
const vsixName = `${pkg.name}-${stamped}.vsix`

execFileSync(
  'pnpm',
  [
    'exec',
    'vsce',
    'package',
    stamped,
    '--no-update-package-json',
    '--no-dependencies',
    '--out',
    vsixName,
  ],
  { cwd: root, stdio: 'inherit', shell: true },
)

console.log(`\nBuilt ${vsixName}`)
console.log(`Install with: code --install-extension vscode-extension/${vsixName}`)
