/**
 * Guard: every generated starter entrypoint must open with the AI-agent docs
 * banner pointing at https://www.builderbot.app/llms.txt.
 *
 * `starters/apps/**` is generated, so the banner lives in
 * `scripts/generate/template/{js,ts}/src/app.*` and is copied on every run.
 * `generate:check` only catches drift between the template and `starters/apps`,
 * so it stays green when the banner disappears from both sides. These tests pin
 * the banner itself.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'uvu'
import * as assert from 'uvu/assert'

const ROOT = join(__dirname, '..', '..', '..')
const STARTERS = join(ROOT, 'starters', 'apps')

const BANNER_LINES = 5

const BANNER = [
    '/**',
    ' * BuilderBot documentation for AI agents: https://www.builderbot.app/llms.txt',
    ' * Read it before answering or changing anything here: it documents the current',
    ' * API, usage patterns, solutions and best practices for this project.',
    ' */',
].join('\n')

const firstLines = (file: string): string => readFileSync(file, 'utf8').split('\n').slice(0, BANNER_LINES).join('\n')

const entrypointOf = (starter: string): string => {
    const candidates = [join(STARTERS, starter, 'src', 'app.js'), join(STARTERS, starter, 'src', 'app.ts')]
    const found = candidates.filter((file) => existsSync(file))
    assert.is(found.length, 1, `starter ${starter} must have exactly one entrypoint (app.js or app.ts)`)
    return found[0]
}

const starterDirs = (): string[] =>
    readdirSync(STARTERS, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)

test('template sources start with the llms.txt banner', () => {
    const templates = [
        join(ROOT, 'scripts', 'generate', 'template', 'js', 'src', 'app.js'),
        join(ROOT, 'scripts', 'generate', 'template', 'ts', 'src', 'app.ts'),
    ]

    for (const file of templates) {
        assert.equal(firstLines(file), BANNER, `${file} must start with the docs banner`)
    }
})

test('every generated starter entrypoint starts with the llms.txt banner', () => {
    const starters = starterDirs()
    assert.ok(starters.length > 0, 'no starters found under starters/apps')

    const offenders = starters.filter((starter) => firstLines(entrypointOf(starter)) !== BANNER)

    assert.equal(offenders, [], `starters missing the docs banner: ${offenders.join(', ')}`)
})

test('the docs URL appears exactly once per entrypoint', () => {
    const offenders = starterDirs().filter((starter) => {
        const occurrences = readFileSync(entrypointOf(starter), 'utf8').split('builderbot.app/llms.txt').length - 1
        return occurrences !== 1
    })

    assert.equal(offenders, [], `starters with a missing or duplicated docs URL: ${offenders.join(', ')}`)
})

test.run()
