const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
    input: 'index.js',
    output: {
        file: 'lib/index.cjs',
        format: 'cjs',
    },
    plugins: [commonjs()],
}
