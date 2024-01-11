import { intro, outro, confirm, select, spinner, isCancel, cancel, note } from '@clack/prompts'
import color from 'picocolors'
import { join } from 'path'
import { existsSync } from 'fs'
import { copyBaseApp } from '../create-app'
import { checkNodeVersion, checkGit } from '../check'
import { PROVIDER_LIST, PROVIDER_DATA } from '../configuration'
import { startInteractiveLegacy } from '../interactive-legacy'

interface CheckResult {
    pass: boolean
    message: string
}

const handleLegacyCli = async (): Promise<void> => {
    await startInteractiveLegacy()
}

const bannerDone = (templateName: string = ''): void => {
    note(
        [
            color.yellow(` cd ${templateName} `),
            color.yellow(` npm install `),
            color.yellow(` npm start `),
            ``,
            `📄 Documentación y Curso:`,
            `   https://bot-whatsapp.netlify.app`,
            ``,
            `🤖 ¿Problemas? Únete:`,
            `   https://link.codigoencasa.com/DISCORD`,
        ].join('\n'),
        'Instrucciones:'
    )
}

const systemRequirements = async (): Promise<void> => {
    const stepCheckGit: CheckResult = await checkGit()

    if (!stepCheckGit.pass) {
        note(stepCheckGit.message)
        cancel('Operacion cancelada')
        return process.exit(0)
    }

    const stepCheckNode: CheckResult = await checkNodeVersion()
    if (!stepCheckNode.pass) {
        note(stepCheckNode.message)
        cancel('Operacion cancelada')
        return process.exit(0)
    }
}

const createApp = async (templateName: string | null): Promise<void> => {
    if (!templateName) throw new Error('TEMPLATE_NAME_INVALID: ' + templateName)
    const possiblesPath: string[] = [
        join(__dirname, '..', '..', 'starters', 'apps', templateName),
        join(__dirname, '..', 'starters', 'apps', templateName),
        join(__dirname, 'starters', 'apps', templateName),
    ]
    const indexOfPath: string | undefined = possiblesPath.find((a) => existsSync(a))
    if (!indexOfPath) throw new Error('TEMPLATE_PATH_NOT_FOUND: ' + templateName)
    await copyBaseApp(indexOfPath, join(process.cwd(), templateName))
}

const startInteractive = async (): Promise<void> => {
    try {
        console.clear()
        console.log('')

        intro(`Vamos a crear un ${color.bgBlue(' Chatbot ')} ✨`)

        const stepContinue = await confirm({
            message: '¿Quieres continuar?',
        })

        if (!stepContinue) {
            cancel('Operacion cancelada')
            return process.exit(0)
        }

        if (isCancel(stepContinue)) {
            cancel('Operacion cancelada')
            return process.exit(0)
        }

        const stepProvider = await select({
            message: '¿Cuál proveedor de whatsapp quieres utilizar?',
            options: PROVIDER_LIST,
        })

        if (isCancel(stepProvider)) {
            cancel('Operacion cancelada')
            return process.exit(0)
        }

        const stepDatabase = await select({
            message: '¿Cuál base de datos quieres utilizar?',
            options: PROVIDER_DATA,
        })

        if (isCancel(stepDatabase)) {
            cancel('Operacion cancelada')
            return process.exit(0)
        }

        const s = spinner()
        s.start('Comprobando requerimientos')
        await systemRequirements()
        s.stop('Comprobando requerimientos')

        s.start(`Creando proyecto`)
        const NAME_DIR: string = ['base', stepProvider, stepDatabase].join('-')
        await createApp(NAME_DIR)
        s.stop(`Creando proyecto`)
        bannerDone(NAME_DIR)
        outro(color.inverse('Finalizado correctamente!'))
    } catch (e: any) {
        if (e?.code === 'ERR_TTY_INIT_FAILED') return handleLegacyCli()
        cancel([`Ups! 🙄 algo no va bien.`, `Revisa los requerimientos mínimos en la documentación`].join('\n'))
        return process.exit(0)
    }
}

export { startInteractive }
