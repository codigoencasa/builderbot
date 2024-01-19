import { copy } from 'fs-extra'
import { join } from 'path'

const PACKAGES_PATH: string = join(process.cwd(), 'packages')
const NAME_PREFIX: string = '@bot-whatsapp'

const [, , appDir]: string[] = process.argv

interface CopyLibPkgOptions {
    overwrite: boolean
}

const copyLibPkg = async (pkgName: string, to: string): Promise<void> => {
    const FROM: string = join(PACKAGES_PATH, pkgName)
    const TO: string = join(process.cwd(), to, 'node_modules', NAME_PREFIX, pkgName)
    const options: CopyLibPkgOptions = { overwrite: true }
    await copy(join(FROM, 'dist'), join(TO, 'dist'), options)
    await copy(join(FROM, 'package.json'), join(TO, 'package.json'))
}

const listLib: string[] = [
    'create-bot-whatsapp',
    'bot',
    // 'database', manuel
    'provider',
    'provider-bailey',
    'provider-twilio',
    'provider-venom',
    'provider-web-whatsapp',
    'provider-wppconnect',
    // 'contexts', manuel
    // 'portal'
]

const main = async (): Promise<void> => {
    if (!appDir) {
        throw new Error('appDir is not specified in the arguments.')
    }
    for (const iterator of listLib) {
        await copyLibPkg(iterator, appDir)
        console.log(`${iterator}: Copiado ✅`)
    }
}

main().catch((error: Error) => {
    console.error('An error occurred:', error.message)
})
