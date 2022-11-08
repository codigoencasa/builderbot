const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
    input: 'index.js',
    output: {
        file: 'lib/core/bundle.core.cjs',
        format: 'cjs',
    },
    plugins: [commonjs()],
}
