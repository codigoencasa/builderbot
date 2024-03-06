import typescript from 'rollup-plugin-typescript2'
import json from '@rollup/plugin-json'
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
        json(),
        nodeResolve({
            resolveOnly: (module) => !/ffmpeg|@wppconnect|@builderbot\/bot|sharp/i.test(module),
        }),
        commonjs(),
        typescript(),
    ],
}
