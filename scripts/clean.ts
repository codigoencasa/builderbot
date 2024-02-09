import { join } from 'path'
import { rimraf } from 'rimraf'
import { readFileSync } from 'fs'

const PACKAGES_PATH: string = join(process.cwd(), 'packages')

/**
 * limpiar los dist
 * @param pkgName
 */
const deleteDist = async (pkgName: string): Promise<void> => {
    const FROM: string = join(PACKAGES_PATH, pkgName)
    await rimraf(join(FROM, 'dist'))
}

/**
 *
 */
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
    const listLib: { name: string }[] = getPkgName()

    for (const iterator of listLib) {
        await deleteDist(iterator.name)
        console.log(`${iterator.name}: Limpiar ✅`)
    }
}

main().catch((error: Error) => {
    console.error('An error occurred:', error.message)
})
