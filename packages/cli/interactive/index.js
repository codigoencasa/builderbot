const { intro, outro, confirm, select, spinner, isCancel, cancel, note } = require('@clack/prompts')
const color = require('picocolors')

const { join } = require('path')
const { existsSync } = require('fs')
const { copyBaseApp } = require('../create-app')
const { checkNodeVersion, checkGit } = require('../check')

const bannerDone = (templateName = '') => {
    note(
        [color.yellow(` cd ${templateName} `), color.yellow(` npm install `), color.yellow(` npm start `)].join('\n'),
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

        intro(color.inverse(' instalador '))

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
            options: [
                { value: 'baileys', label: 'Baileys', hint: 'gratis' },
                { value: 'venom', label: 'Venom', hint: 'gratis' },
                { value: 'wweb', label: 'whatsapp-web.js', hint: 'gratis' },
                { value: 'twilio', label: 'Twilio' },
                { value: 'meta', label: 'Meta' },
            ],
        })

        if (isCancel(stepProvider)) {
            cancel('Operacion cancelada')
            return process.exit(0)
        }

        const stepDatabase = await select({
            message: '¿Cuál base de datos quieres utilizar?',
            options: [
                { value: 'memory', label: 'Memory' },
                { value: 'json', label: 'Json' },
                { value: 'mongo', label: 'Mongo' },
                { value: 'mysql', label: 'MySQL' },
            ],
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
        console.log(e)
        cancel([`Ups! 🙄 algo no va bien.`, `Revisa los requerimientos minimos en la documentacion`].join('\n'))
        return process.exit(0)
    }
}

module.exports = { startInteractive }
