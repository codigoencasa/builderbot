import { existsSync } from 'fs'
import { join } from 'path'
import color from 'picocolors'
import prompts from 'prompts'

import { checkNodeVersion, checkOs, checkGit } from '../check'
import { PROVIDER_LIST, PROVIDER_DATA } from '../configuration'
import { copyBaseApp } from '../create-app'

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
                `[Acknowledgements]: This is an OpenSource project, if you intend to collaborate you can do so:`,
                `[😉] Buying a coffee https://www.buymeacoffee.com/leifermendez`,
                `[⭐] Giving a star  https://github.com/codigoencasa/bot-whatsapp`,
                `[🚀] Making improvements in the code`,
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
        console.error(color.bgRed(`Oops! 🙄 something is not right.`))
        console.error(color.bgRed(`Check the minimum requirements in the documentation`))
    }
}

const nextSteps = async (): Promise<void> => {
    const questions: prompts.PromptObject[] = [
        {
            type: 'text',
            name: 'outDir',
            message: 'Do you want to create a bot? (Y/n)',
        },
        {
            type: 'multiselect',
            name: 'providerWs',
            message: 'Which WhatsApp provider do you want to use?',
            choices: PROVIDER_LIST.map((c: ProviderChoice) => ({ title: c.label, value: c.value })),
            max: 1,
            hint: 'Space to select',
            instructions: '↑/↓',
        },
        {
            type: 'multiselect',
            name: 'providerDb',
            message: 'Which database do you want to use?',
            choices: PROVIDER_DATA.map((c: ProviderChoice) => ({ title: c.label, value: c.value })),
            max: 1,
            hint: 'Space to select',
            instructions: '↑/↓',
        },
    ]

    const onCancel = (): boolean => {
        console.log('Process canceled!')
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
            console.log(color.bgMagenta(`⚡⚡⚡ INSTRUCTIONS ⚡⚡⚡`))
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
            console.log(color.red(`You must select a WhatsApp provider. Press [Space] to select`))
            process.exit(1)
        }
        return answer
    }

    const dbProvider = async (): Promise<string> => {
        const [answer] = providerDb
        if (!providerDb.length) {
            console.log(color.red(`You must select a database provider. Press [Space] to select`))
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
