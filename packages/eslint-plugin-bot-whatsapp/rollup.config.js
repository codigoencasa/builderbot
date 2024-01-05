const banner = require('../../config/banner.rollup.json')
const commonjs = require('@rollup/plugin-commonjs')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { join } = require('path')

const PATH = join(__dirname, 'lib', 'eslint-plugin-bot-whatsapp.cjs')

module.exports = {
    input: join(__dirname, 'index.js'),
    output: {
        banner: banner['banner.output'].join(''),
        file: PATH,
        format: 'cjs',
    },
    plugins: [commonjs(), nodeResolve()],
}
