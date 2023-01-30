const dts = require('rollup-plugin-dts').default
const esbuild = require('rollup-plugin-esbuild').default
const banner = require('../../config/banner.rollup.json')
const { join } = require('path')

module.exports = [
    {
        input: join(__dirname, 'src/index.ts'),
        output: {
            banner: banner['banner.output'].join(''),
            file: join(__dirname, 'lib', 'bundle.bot.cjs'),
            format: 'cjs',
            sourcemap: true,
        },
        plugins: [esbuild({ tsconfig: './tsconfig.json' })],
    },
    {
        banner: banner['banner.output'].join(''),
        input: join(__dirname, `src/index.ts`),
        plugins: [dts({ tsconfig: './tsconfig.json' })],
        output: {
            file: `lib/bundle.d.ts`,
        },
    },
]
