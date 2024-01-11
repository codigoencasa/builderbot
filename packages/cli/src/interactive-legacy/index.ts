import prompts from 'prompts'
import { join } from 'path'
import color from 'picocolors'
import { existsSync } from 'fs'
import { copyBaseApp } from '../create-app'
import { checkNodeVersion, checkOs, checkGit } from '../check'
import { PROVIDER_LIST, PROVIDER_DATA } from '../configuration'

interface ProviderChoice {
    label: string
    value: string
}

interface Response {
    outDir?: string
    providerDb?: string[]
    providerWs?: string[]
}

const bannerDone = (): void => {
    console.log(``)
    console.log(
        color.cyan(
            [
                `[Agradecimientos]: Este es un proyecto OpenSource, si tienes intenciones de colaborar puedes hacerlo:`,
                `[😉] Comprando un cafe https://www.buymeacoffee.com/leifermendez`,
                `[⭐] Dar estrella  https://github.com/codigoencasa/bot-whatsapp`,
                `[🚀] Realizando mejoras en el codigo`,
            ].join('\n')
        )
    )
    console.log(``)
}

const startInteractiveLegacy = async (): Promise<void> => {
    try {
        console.clear()
        await checkNodeVersion()
        checkOs()
        await checkGit()
        console.clear()
        await nextSteps()
    } catch (e) {
        console.error(color.bgRed(`Ups! 🙄 algo no va bien.`))
        console.error(color.bgRed(`Revisa los requerimientos minimos en la documentacion`))
    }
}

const nextSteps = async (): Promise<void> => {
    const questions: prompts.PromptObject[] = [
        {
            type: 'text',
            name: 'outDir',
            message: 'Quieres crear un bot? (Y/n)',
        },
        {
            type: 'multiselect',
            name: 'providerWs',
            message: '¿Cuál proveedor de whatsapp quieres utilizar?',
            choices: PROVIDER_LIST.map((c: ProviderChoice) => ({ title: c.label, value: c.value })),
            max: 1,
            hint: 'Espacio para seleccionar',
            instructions: '↑/↓',
        },
        {
            type: 'multiselect',
            name: 'providerDb',
            message: '¿Cuál base de datos quieres utilizar?',
            choices: PROVIDER_DATA.map((c: ProviderChoice) => ({ title: c.label, value: c.value })),
            max: 1,
            hint: 'Espacio para seleccionar',
            instructions: '↑/↓',
        },
    ]

    const onCancel = (): boolean => {
        console.log('¡Proceso cancelado!')
        return true
    }
    const response: Response = await prompts(questions, { onCancel })
    const { outDir = '', providerDb = [], providerWs = [] } = response

    const createApp = async (templateName: string): Promise<string | boolean> => {
        if (!templateName) throw new Error('TEMPLATE_NAME_INVALID: ' + templateName)

        const possiblesPath = [
            join(__dirname, '..', '..', 'starters', 'apps', templateName),
            join(__dirname, '..', 'starters', 'apps', templateName),
            join(__dirname, 'starters', 'apps', templateName),
        ]

        const answer = outDir.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            const indexOfPath = possiblesPath.find((a) => existsSync(a))
            if (!indexOfPath) throw new Error('Path does not exist: ' + indexOfPath)
            await copyBaseApp(indexOfPath, join(process.cwd(), templateName))
            console.log(``)
            console.log(color.bgMagenta(`⚡⚡⚡ INSTRUCCIONES ⚡⚡⚡`))
            console.log(color.yellow(`cd ${templateName}`))
            console.log(color.yellow(`npm install`))
            console.log(color.yellow(`npm start`))
            console.log(``)

            return outDir
        }
        return false
    }

    const vendorProvider = async (): Promise<string> => {
        const [answer] = providerWs
        if (!providerWs.length) {
            console.log(color.red(`Debes seleccionar un proveedor de whatsapp. Tecla [Space] para seleccionar`))
            process.exit(1)
        }
        return answer
    }

    const dbProvider = async (): Promise<string> => {
        const [answer] = providerDb
        if (!providerDb.length) {
            console.log(color.red(`Debes seleccionar un proveedor de base de datos. Tecla [Space] para seleccionar`))
            process.exit(1)
        }
        return answer
    }

    const providerAdapter: string = await vendorProvider()
    const dbAdapter: string = await dbProvider()
    const NAME_DIR: string = ['base', providerAdapter, dbAdapter].join('-')
    await createApp(NAME_DIR)
    bannerDone()
}

export { startInteractiveLegacy }
