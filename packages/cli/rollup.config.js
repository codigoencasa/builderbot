import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'
import { ensureDir, copy } from 'fs-extra'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PATH_STARTERTS = join(process.cwd(), '..', '..', 'starters')
const DEST_STARTERTS = join(__dirname, 'dist', 'starters')

function copyStarts() {
    return {
        name: 'copyStartersPlugin',
        async buildStart() {
            await ensureDir(DEST_STARTERTS)
            await copy(PATH_STARTERTS, DEST_STARTERTS)
        },
    }
}

export default {
    input: ['src/index.ts'],
    output: {
        dir: 'dist',
        entryFileNames: '[name].cjs',
        format: 'cjs',
        exports: 'named',
    },
    plugins: [commonjs(), nodeResolve(), typescript(), copyStarts()],
}
