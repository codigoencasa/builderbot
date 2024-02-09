import { join } from 'path'
import { rimraf } from 'rimraf'

const PACKAGES_PATH: string = join(process.cwd(), 'packages')

/**
 * limpiar los dist
 * @param pkgName
 */
const deleteDist = async (pkgName: string): Promise<void> => {
    const FROM: string = join(PACKAGES_PATH, pkgName)
    await rimraf(join(FROM, 'dist'))
}

const listLib: { name: string }[] = [
    {
        name: 'create-bot-whatsapp',
    },
    {
        name: 'bot',
    },
    {
        name: 'provider-baileys',
    },
    {
        name: 'provider-twilio',
    },
    {
        name: 'provider-venom',
    },
    {
        name: 'provider-web-whatsapp',
    },
    {
        name: 'provider-wppconnect',
    },
    {
        name: 'contexts-dialogflow',
    },
    {
        name: 'contexts-dialogflow-cx',
    },
    {
        name: 'eslint-plugin-bot-whatsapp',
    },
]

const main = async (): Promise<void> => {
    for (const iterator of listLib) {
        await deleteDist(iterator.name)
        console.log(`${iterator.name}: Limpiar ✅`)
    }
}

main().catch((error: Error) => {
    console.error('An error occurred:', error.message)
})
