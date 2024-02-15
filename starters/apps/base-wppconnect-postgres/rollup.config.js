import terser from '@rollup/plugin-terser'
import typescript from 'rollup-plugin-typescript2'

export default {
    input: './app.ts',
    output: {
        file: 'dist/app.js',
        format: 'esm',
    },
    plugins: [typescript(), terser()],
}
