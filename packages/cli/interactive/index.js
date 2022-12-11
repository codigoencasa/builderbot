const prompts = require('prompts')
const { yellow, red } = require('kleur')
const { copyBaseApp } = require('../create-app')
const { checkNodeVersion, checkOs } = require('../check')

const startInteractive = async () => {
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
                { title: 'whatsapp-web.js (gratis)', value: 'wweb' },
                { title: 'Twilio', value: 'twilio' },
                { title: 'Baileys (gratis)', value: 'bailey', disabled: true },
                { title: 'API Oficial (Meta)', value: 'meta', disabled: true },
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
                { title: 'Mongo', value: 'mongo' },
                { title: 'MySQL', value: 'mysql' },
                { title: 'Json', value: 'json', disabled: true },
            ],
            max: 1,
            hint: 'Espacio para seleccionar',
            instructions: '↑/↓',
        },
    ]

    console.clear()
    checkNodeVersion()
    checkOs()
    const onCancel = () => {
        console.log('¡Proceso cancelado!')
        return true
    }
    const response = await prompts(questions, { onCancel })
    const { outDir = '', providerDb = [], providerWs = [] } = response
    /**
     * @deprecated
     * Question
     * @returns
     */
    // const installOrUdpateDep = async () => {
    //     const answer = dependencies.toLowerCase() || 'n'
    //     if (answer.includes('n')) return true

    //     if (answer.includes('y')) {
    //         await installAll()
    //         return true
    //     }
    // }

    // const cleanAllSession = async () => {
    //     const answer = cleanTmp.toLowerCase() || 'n'
    //     if (answer.includes('n')) return true

    //     if (answer.includes('y')) {
    //         await cleanSession()
    //         return true
    //     }
    // }

    /**
     * Crear una app (copiar plantilla)
     * @returns
     */
    const createApp = async (templateName = null) => {
        if (!templateName)
            throw new Error('TEMPLATE_NAME_INVALID: ', templateName)
        const answer = outDir.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await copyBaseApp(templateName)
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
            console.log(
                red(
                    `Debes seleccionar un proveedor de whatsapp. Tecla [Space] para seleccionar`
                )
            )
            process.exit(1)
        }
        console.log(yellow(`'Deberia crer una carpeta en root/provider'`))
        return answer
    }

    /**
     * Selecionar adaptador de base de datos
     * @returns
     */
    const dbProvider = async () => {
        const [answer] = providerDb
        if (!providerDb.length) {
            console.log(
                red(
                    `Debes seleccionar un proveedor de base de datos. Tecla [Space] para seleccionar`
                )
            )
            process.exit(1)
        }
        return answer
    }

    const providerAdapter = await vendorProvider()
    const dbAdapter = await dbProvider()
    const NAME_DIR = ['base', providerAdapter, dbAdapter].join('-')
    await createApp(NAME_DIR)
}

module.exports = { startInteractive }
