import { copy } from 'fs-extra'
import { join } from 'path'
import { readFileSync } from 'fs'

const PACKAGES_PATH: string = join(process.cwd(), 'packages')
const NAME_PREFIX: string = '@bot-whatsapp'

const [, , appDir]: string[] = process.argv

interface CopyLibPkgOptions {
    overwrite: boolean
}

/**
 * copiar dist
 * @param pkgName
 * @param to
 */
const copyLibPkg = async (pkgName: string, to: string): Promise<void> => {
    const FROM: string = join(PACKAGES_PATH, pkgName)
    const TO: string = join(process.cwd(), to, 'node_modules', NAME_PREFIX, pkgName)
    const options: CopyLibPkgOptions = { overwrite: true }
    await copy(join(FROM, 'dist'), join(TO, 'dist'), options)
    await copy(join(FROM, 'package.json'), join(TO, 'package.json'))
}

const getPkgName = () => {
    try {
        const pathLerna = join(process.cwd(), 'lerna.json')
        const json = readFileSync(pathLerna, 'utf8')
        const lerna = JSON.parse(json)
        return lerna.packages.map((pkg: string) => {
            const name = pkg.split('/').pop()
            return { name }
        })
    } catch (error) {
        console.log(`Error:`, error)
        return []
    }
}

const main = async (): Promise<void> => {
    if (!appDir) {
        throw new Error('appDir is not specified in the arguments.')
    }
    const listLib: { name: string }[] = getPkgName()
    for (const iterator of listLib) {
        await copyLibPkg(iterator.name, appDir)
        console.log(`${iterator.name}: Copiado ✅`)
    }
}

main().catch((error: Error) => {
    console.error('An error occurred:', error.message)
})
