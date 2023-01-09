const banner = require('../../config/banner.rollup.json')
const { join } = require('path')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
    input: join(__dirname, 'portal.http.js'),
    output: {
        banner: banner['banner.output'].join(''),
        file: join(__dirname, 'lib', 'portal.http.cjs'),
        format: 'cjs',
    },
    plugins: [commonjs()],
}
