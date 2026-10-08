import type { Config } from 'jest'

const config: Config = {
    maxWorkers: 2,
    preset: 'ts-jest',
    verbose: true,
    cache: true,
    testEnvironment: 'node',
}

export default config
