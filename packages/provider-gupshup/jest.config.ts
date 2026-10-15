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
    coverageThreshold: {
        global: {
            statements: 50,
            branches: 40,
            functions: 45,
            lines: 50,
        },
    },
}

export default config
