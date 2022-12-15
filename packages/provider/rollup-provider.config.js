const banner = require('../../config/banner.rollup.json')
const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = [
    {
        input: join(__dirname, 'src', 'web-whatsapp', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'web-whatsapp', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'twilio', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'twilio', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
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
        input: join(__dirname, 'src', 'venom', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'venom', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'baileys', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'baileys', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
    {
        input: join(__dirname, 'src', 'meta', 'index.js'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'meta', 'index.cjs'),
            format: 'cjs',
        },
        plugins: [commonjs()],
    },
]
