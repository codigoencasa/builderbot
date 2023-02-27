const { intro, outro, confirm, select, spinner, isCancel, cancel, note } = require('@clack/prompts')
const color = require('picocolors')

const { join } = require('path')
const { existsSync } = require('fs')
const { copyBaseApp } = require('../create-app')
const { checkNodeVersion, checkGit } = require('../check')
const { PROVIDER_LIST, PROVIDER_DATA } = require('../configuration')
const { startInteractiveLegacy } = require('../interactive-legacy')

// const PATH_BASE = [join(__dirname, '..', '..', 'package.json'), join(__dirname, '..', 'package.json')].find((i) =>
//     existsSync(i)
// )

// const pkgJson = () => {
//     const pkgJson = PATH_BASE
//     const rawFile = readFileSync(pkgJson, 'utf-8')
//     return JSON.parse(rawFile)
// }

const handleLegacyCli = async () => {
    await startInteractiveLegacy()
}

const bannerDone = (templateName = '') => {
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

/**
 * @returns
 */
const systemRequirements = async () => {
    const stepCheckGit = await checkGit()

    if (!stepCheckGit.pass) {
        note(stepCheckGit.message)
        cancel('Operacion cancelada')
        return process.exit(0)
    }

    const stepCheckNode = await checkNodeVersion()
    if (!stepCheckNode.pass) {
        note(stepCheckNode.message)
        cancel('Operacion cancelada')
        return process.exit(0)
    }
}

const createApp = async (templateName = null) => {
    if (!templateName) throw new Error('TEMPLATE_NAME_INVALID: ', templateName)
    const possiblesPath = [
        join(__dirname, '..', '..', 'starters', 'apps', templateName),
        join(__dirname, '..', 'starters', 'apps', templateName),
        join(__dirname, 'starters', 'apps', templateName),
    ]
    const indexOfPath = possiblesPath.find((a) => existsSync(a))
    await copyBaseApp(indexOfPath, join(process.cwd(), templateName))
    return
}

const startInteractive = async () => {
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
        const NAME_DIR = ['base', stepProvider, stepDatabase].join('-')
        await createApp(NAME_DIR)
        s.stop(`Creando proyecto`)
        bannerDone(NAME_DIR)
        outro(color.inverse('Finalizado correctamente!'))
    } catch (e) {
        if (e?.code === 'ERR_TTY_INIT_FAILED') return handleLegacyCli()
        cancel([`Ups! 🙄 algo no va bien.`, `Revisa los requerimientos minimos en la documentacion`].join('\n'))
        return process.exit(0)
    }
}

module.exports = { startInteractive }
