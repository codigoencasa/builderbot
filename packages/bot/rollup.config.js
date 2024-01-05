const banner = require('../../config/banner.rollup.json')
const commonjs = require('@rollup/plugin-commonjs')
const strip = require('@rollup/plugin-strip')
const { nodeResolve } = require('@rollup/plugin-node-resolve')
const { join } = require('path')

module.exports = [
    {
        input: join(__dirname, 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'bundle.bot.cjs'),
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [
            strip({
                exclude: ['**/interactive.js'],
            }),
            commonjs(),
            nodeResolve(),
        ],
    },
]
