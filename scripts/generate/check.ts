/**
 * Guard: `starters/apps/**` must stay in sync with the generator source
 * (`scripts/generate/template` + `zones`).
 *
 * `create-builderbot` bundles `dist/starters` copied from `starters/apps` at
 * build time, so editing the zones without regenerating ships **stale templates**
 * to npm. This script regenerates and fails when the result differs from what is
 * committed.
 *
 * Usage: `pnpm run generate:check`
 */
import { execSync } from 'node:child_process'

const run = (command: string): string => execSync(command, { encoding: 'utf8' })

try {
    execSync('pnpm run generate.templates', { stdio: 'inherit' })
} catch {
    console.error('✖ Template generation failed.')
    process.exit(1)
}

const status = run('git status --porcelain -- starters/apps').trim()

if (status) {
    console.error('✖ starters/apps is out of sync with scripts/generate:\n')
    console.error(status)
    console.error("\n→ Run 'pnpm run generate.templates' and commit the result.")
    process.exit(1)
}

console.log('✔ starters/apps is in sync with scripts/generate.')
