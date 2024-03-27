import { copy } from 'fs-extra'
import { join } from 'path'
import { readFileSync, readdirSync } from 'fs'

const PACKAGES_PATH: string = join(process.cwd(), 'packages')
const NAME_PREFIX: string = '@builderbot'

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
            return { name, pkg }
        })
    } catch (error) {
        console.log(`Error:`, error)
        return []
    }
}

const main = async (): Promise<void> => {
    const onlyBase = readdirSync(process.cwd()).filter((i) => i.startsWith('base-'))
    const copyPerBase = async (appDir: string) => {
        const listLib: { name: string }[] = getPkgName()
        for (const iterator of listLib) {
            await copyLibPkg(iterator.name, appDir)
            console.log(`✅ ${iterator.name} `)
        }
    }

    for (const base of onlyBase) {
        console.log(``)
        console.log(`➡️  Copying in ${base}...`)
        await copyPerBase(base)
        console.log(`🆗 Finish in ${base}`)
        console.log(``)
    }
}

main().catch((error: Error) => {
    console.error('An error occurred:', error.message)
})
