/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest'

const config: Config = {
    verbose: true,
    cache: true,
    transform: {
        '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
    },
}

export default config
