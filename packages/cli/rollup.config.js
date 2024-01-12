import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'
import terser from '@rollup/plugin-terser'

export default {
    input: ['src/index.ts'],
    output: {
        dir: 'dist',
        entryFileNames: '[name].cjs',
        format: 'cjs',
        exports: 'named',
    },
    plugins: [
        // copy({
        //     targets: [{ src: 'starters/*', dest: join(__dirname, 'starters') }],
        // }),
        commonjs(),
        nodeResolve(),
        typescript(),
        terser(),
    ],
}
