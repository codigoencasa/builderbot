const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { join } = require('path')

const PATH = join(__dirname, 'lib', 'core', 'bundle.core.cjs')

module.exports = {
    input: 'index.js',
    output: {
        file: PATH,
        format: 'cjs',
    },
    plugins: [commonjs(), nodeResolve()],
}
