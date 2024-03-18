import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
export default {
    input: ['src/index.ts'],
    output: [
        {
            dir: 'dist',
            entryFileNames: '[name].cjs',
            format: 'cjs',
            exports: 'named',
        },
    ],
    plugins: [
        commonjs(),
        nodeResolve({
            resolveOnly: (module) => !/mysql2|@builderbot\/bot/i.test(module),
        }),
        typescript(),
    ],
}
