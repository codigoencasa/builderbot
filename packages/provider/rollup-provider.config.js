const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')

const PATH = join(__dirname, 'lib', 'bundle.provider.cjs')

module.exports = {
    input: 'index.js',
    output: {
        file: PATH,
        format: 'cjs',
    },
    plugins: [commonjs()],
}
