/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest'

const config: Config = {
    maxWorkers: 2,
    preset: 'ts-jest',
    verbose: true,
    cache: true,
    testEnvironment: 'node',
    // Removes `<name>_sessions/` dirs and `*.log` files created by tests in the
    // package cwd. See jest.globalTeardown.ts.
    globalTeardown: '<rootDir>/jest.globalTeardown.ts',
}

export default config
