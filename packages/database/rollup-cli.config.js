const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { join } = require('path')

const PATH = join(__dirname, 'lib', 'database', 'bundle.database.cjs')

module.exports = {
    input: join(__dirname, 'index.js'),
    output: {
        file: PATH,
        format: 'cjs',
    },
    plugins: [commonjs(), nodeResolve()],
}
