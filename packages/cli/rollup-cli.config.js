const banner = require('../../config/banner.rollup.json')
const commonjs = require('@rollup/plugin-commonjs')
const copy = require('rollup-plugin-copy')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { join } = require('path')

const PATH = join(__dirname, 'lib', 'cli', 'bundle.cli.cjs')

module.exports = {
    input: join(__dirname, 'index.js'),
    output: {
        banner: banner['banner.output'].join(''),
        file: PATH,
        format: 'cjs',
    },
    plugins: [
        copy({
            targets: [{ src: 'starters/*', dest: join(__dirname, 'starters') }],
        }),
        commonjs(),
        nodeResolve(),
    ],
}
