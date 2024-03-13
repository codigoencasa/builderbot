import typescript from 'rollup-plugin-typescript2'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { copy } from 'fs-extra'
import path from 'path'

function copyPlugin(options = {}) {
    const { source, destination } = options

    return {
        name: 'copy-plugin',

        async buildStart() {
            if (!source || !destination) {
                throw new Error('Debe proporcionar tanto la ruta de origen como la de destino.')
            }

            const sourcePath = path.resolve(source)
            const destinationPath = path.resolve(destination)

            const options = { overwrite: true }
            await copy(source, destinationPath, options)

            console.log(`Archivos copiados de "${sourcePath}" a "${destinationPath}".`)
        },
    }
}

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
            resolveOnly: (module) => !/@builderbot\/cli|sharp/i.test(module),
        }),
        copyPlugin({
            source: '../../starters/apps',
            destination: 'dist/starters/apps',
        }),
        typescript(),
    ],
}
