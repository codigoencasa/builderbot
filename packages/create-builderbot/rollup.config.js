import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

export default {
    input: ['src/index.ts'],
    output: {
        dir: 'dist',
        entryFileNames: '[name].cjs',
        format: 'cjs',
        exports: 'named',
    },
    plugins: [
        commonjs(),
        nodeResolve({ resolveOnly: ['!rpt2'] }),
        typescript(),
        // terser()
    ],
}
