/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest'

const config: Config = {
    maxWorkers: 2,
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    },
    verbose: true,
    cache: true,
    // Each suite owns a temporary cwd. Never scan application directories to
    // guess which sessions/logs are test artifacts.
    testEnvironment: '<rootDir>/jest.environment.cjs',
}

export default config
