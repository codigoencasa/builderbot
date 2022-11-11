const { join } = require('path')

const PATH = join(__dirname, 'lib', 'provider', 'bundle.provider.cjs')

module.exports = {
    input: 'index.js',
    output: {
        file: PATH,
        format: 'cjs',
    },
    plugins: [],
}
