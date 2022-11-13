const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')

const PATH = join(__dirname, 'lib', 'bundle.provider.cjs')

module.exports = {
    input: 'index.js',
    output: {
        file: PATH,
        format: 'cjs',
    },
    plugins: [
        commonjs(),
        nodeResolve({
            resolveOnly: (module) => {
                return !module === '@bot-whatsapp/bot'
            },
        }),
    ],
}
