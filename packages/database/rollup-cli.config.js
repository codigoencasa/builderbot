const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
    input: 'index.js',
    output: {
        file: 'lib/database/bundle.database.cjs',
        format: 'cjs',
    },
    plugins: [commonjs()],
}
