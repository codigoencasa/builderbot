import type { Config } from 'jest'

const config: Config = {
    preset: 'ts-jest',
    verbose: true,
    cache: true,
    testEnvironment: 'node',
}

export default config
