import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const workflow = readFileSync(new URL('../../.github/workflows/releases-dev.yml', import.meta.url), 'utf8')
const releaseJob = workflow.split('\n    release:\n')[1]
assert.ok(releaseJob, 'release job must exist')
const releaseCondition = releaseJob.match(/^        if: \$\{\{ (.+) \}\}$/m)?.[1]
assert.ok(releaseCondition, 'release job must have an explicit condition')

// These workflow expressions use the same boolean operators as JavaScript.
// Model GitHub startsWith faithfully: its string comparison ignores case.
const evaluate = (expression, github, inputs = {}) =>
    runInNewContext(
        expression,
        {
            github,
            inputs,
            startsWith: (value, prefix) => String(value).toLowerCase().startsWith(String(prefix).toLowerCase()),
        },
        { timeout: 100 }
    )

const pullRequest = (ref, fork = false) => ({
    event_name: 'pull_request',
    event: { pull_request: { head: { ref, repo: { fork } } } },
})

test('docs/ PRs skip the entire release job while validation stays enabled', () => {
    for (const ref of ['docs/dev-docs-alignment', 'docs/nested/readme', 'Docs/README']) {
        assert.equal(evaluate(releaseCondition, pullRequest(ref)), false, ref)
    }
    const validationJobs = workflow.split('\n    release:\n')[0]
    assert.match(validationJobs, /branches:\s*\n\s*- builderbot-dev/)
    assert.doesNotMatch(validationJobs, /paths-ignore:/)
    for (const command of ['pnpm test', 'pnpm run generate:check', 'pnpm run clean.lib && pnpm run build']) {
        assert.ok(validationJobs.includes(`run: ${command}`), command)
    }
    assert.ok(validationJobs.includes('run: node --test scripts/tests/dev-release-guard.test.mjs'))
    assert.match(releaseJob, /needs: \[test, build\]/)
    assert.doesNotMatch(releaseJob, /continue-on-error:/)
})

test('existing same-repository non-doc PRs still enter the release job', () => {
    for (const ref of ['feat/feature', 'fix/docs', 'docs', 'docs-update']) {
        assert.equal(evaluate(releaseCondition, pullRequest(ref)), true, ref)
    }
})

test('fork PRs still cannot enter the release job', () => {
    for (const ref of ['feat/feature', 'docs/readme']) {
        assert.equal(evaluate(releaseCondition, pullRequest(ref, true)), false, ref)
    }
})

test('manual dispatch retains both dry-run and real-release behavior', () => {
    const dispatch = { event_name: 'workflow_dispatch', event: {} }
    const publishConditions = [...releaseJob.matchAll(/^              if: \$\{\{ (.+) \}\}$/gm)].map(
        (match) => match[1]
    )
    assert.equal(publishConditions.length, 3, 'dry-run report, real publish and version log have conditions')
    for (const dry_run of [false, true]) {
        assert.equal(evaluate(releaseCondition, dispatch, { dry_run }), true)
        assert.deepEqual(
            publishConditions.map((condition) => evaluate(condition, dispatch, { dry_run })),
            [dry_run, !dry_run, !dry_run]
        )
    }
})
