const banner = require('../../config/banner.rollup.json')
const commonjs = require('@rollup/plugin-commonjs')
const { join } = require('path')

module.exports = [
    {
        input: join(__dirname, 'src', 'mock', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'mock', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'dialogflow', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'dialogflow', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'dialogflow-cx', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'dialogflow-cx', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
]
