/**
 * LAYER: Infrastructure
 * Contains: IsolatedTestEnvironment
 * Rules: Owns only the temporary workspace it creates for a test suite.
 * BigO: O(1) score:5
 * keywords: [IsolatedTestEnvironment, TestWorkspace]
 * GOAL: Keep test sessions and logs outside application directories and delete only owned artifacts.
 */
const { mkdtempSync, rmSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')
const { TestEnvironment } = require('jest-environment-node')

module.exports = class IsolatedTestEnvironment extends TestEnvironment {
    async setup() {
        await super.setup()
        this.originalCwd = process.cwd()
        this.workspace = mkdtempSync(join(tmpdir(), 'builderbot-baileys-test-'))
        // This runs in the environment, not in the sandboxed test's process shim.
        process.chdir(this.workspace)
    }

    async teardown() {
        try {
            await super.teardown()
        } finally {
            if (this.workspace) {
                process.chdir(this.originalCwd)
                rmSync(this.workspace, { recursive: true, force: true })
            }
        }
    }
}
