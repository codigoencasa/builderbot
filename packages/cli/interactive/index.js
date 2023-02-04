const prompts = require('prompts')
const { join } = require('path')
const { yellow, red, cyan, bgMagenta, bgRed } = require('kleur')
const { existsSync } = require('fs')
const { copyBaseApp } = require('../create-app')
const { checkNodeVersion, checkOs, checkGit } = require('../check')

const bannerDone = () => {
    console.log(``)
    console.log(
        cyan(
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

const startInteractive = async () => {
    try {
        console.clear()
        await checkNodeVersion()
        checkOs()
        await checkGit()
        console.clear()
        await nextSteps()
    } catch (e) {
        console.error(bgRed(`Ups! 🙄 algo no va bien.`))
        console.error(bgRed(`Revisa los requerimientos minimos en la documentacion`))
    }
}

const nextSteps = async () => {
    const questions = [
        {
            type: 'text',
            name: 'outDir',
            message: 'Quieres crear un bot? (Y/n)',
        },
        {
            type: 'multiselect',
            name: 'providerWs',
            message: '¿Cuál proveedor de whatsapp quieres utilizar?',
            choices: [
                { title: 'Baileys (gratis)', value: 'baileys' },
                { title: 'Venom (gratis)', value: 'venom' },
                { title: 'whatsapp-web.js (gratis)', value: 'wweb' },
                { title: 'Twilio', value: 'twilio' },
                { title: 'Meta', value: 'meta' },
            ],
            max: 1,
            hint: 'Espacio para seleccionar',
            instructions: '↑/↓',
        },
        {
            type: 'multiselect',
            name: 'providerDb',
            message: '¿Cuál base de datos quieres utilizar?',
            choices: [
                { title: 'Memory', value: 'memory' },
                { title: 'Json', value: 'json' },
                { title: 'Mongo', value: 'mongo' },
                { title: 'MySQL', value: 'mysql' },
            ],
            max: 1,
            hint: 'Espacio para seleccionar',
            instructions: '↑/↓',
        },
    ]

    const onCancel = () => {
        console.log('¡Proceso cancelado!')
        return true
    }
    const response = await prompts(questions, { onCancel })
    const { outDir = '', providerDb = [], providerWs = [] } = response

    const createApp = async (templateName = null) => {
        if (!templateName) throw new Error('TEMPLATE_NAME_INVALID: ', templateName)

        const possiblesPath = [
            join(__dirname, '..', '..', 'starters', 'apps', templateName),
            join(__dirname, '..', 'starters', 'apps', templateName),
            join(__dirname, 'starters', 'apps', templateName),
        ]

        const answer = outDir.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            const indexOfPath = possiblesPath.find((a) => existsSync(a))
            await copyBaseApp(indexOfPath, join(process.cwd(), templateName))
            console.log(``)
            console.log(bgMagenta(`⚡⚡⚡ INSTRUCCIONES ⚡⚡⚡`))
            console.log(yellow(`cd ${templateName}`))
            console.log(yellow(`npm install`))
            console.log(yellow(`npm start`))
            console.log(``)

            return outDir
        }
    }

    /**
     * Selccionar Provider (meta, twilio, etc...)
     * @returns
     */
    const vendorProvider = async () => {
        const [answer] = providerWs
        if (!providerWs.length) {
            console.log(red(`Debes seleccionar un proveedor de whatsapp. Tecla [Space] para seleccionar`))
            process.exit(1)
        }
        return answer
    }

    /**
     * Selecionar adaptador de base de datos
     * @returns
     */
    const dbProvider = async () => {
        const [answer] = providerDb
        if (!providerDb.length) {
            console.log(red(`Debes seleccionar un proveedor de base de datos. Tecla [Space] para seleccionar`))
            process.exit(1)
        }
        return answer
    }

    const providerAdapter = await vendorProvider()
    const dbAdapter = await dbProvider()
    const NAME_DIR = ['base', providerAdapter, dbAdapter].join('-')
    await createApp(NAME_DIR)
    bannerDone()
}

module.exports = { startInteractive }
