const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
    input: 'index.js',
    output: {
        file: 'lib/provider/bundle.provider.cjs',
        format: 'cjs',
    },
    plugins: [commonjs()],
}
