import typescript from 'rollup-plugin-typescript2'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
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
        json(),
        commonjs(),
        nodeResolve({
            resolveOnly: (module) => !/axios|@builderbot\/bot/i.test(module),
        }),
        typescript(),
    ],
}
