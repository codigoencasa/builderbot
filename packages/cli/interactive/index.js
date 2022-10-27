const prompts = require('prompts')
const { yellow, red } = require('kleur')
const { installAll } = require('../install')
const { cleanSession } = require('../clean')
const { checkNodeVersion, checkOs } = require('../check')
const { jsonConfig } = require('../configuration')

const startInteractive = async () => {
    const questions = [
        {
            type: 'text',
            name: 'dependencies',
            message:
                'Quieres actualizar las librerias "whatsapp-web.js"? (Y/n)',
        },
        {
            type: 'text',
            name: 'cleanTmp',
            message: 'Quieres limpiar la session del bot? (Y/n)',
        },
        {
            type: 'multiselect',
            name: 'providerWs',
            message: 'Proveedor de Whatsapp',
            choices: [
                { title: 'whatsapp-web.js', value: 'whatsapp-web.js' },
                { title: 'API Oficial (Meta)', value: 'meta', disabled: true },
                { title: 'Twilio', value: 'twilio', disabled: true },
            ],
            max: 1,
            hint: 'Espacio para selecionar',
            instructions: '↑/↓',
        },
        {
            type: 'multiselect',
            name: 'providerDb',
            message: 'Cual base de datos quieres usar',
            choices: [
                { title: 'JSONFile', value: 'json' },
                { title: 'MySQL', value: 'mysql', disabled: true },
                { title: 'Mongo', value: 'mongo', disabled: true },
            ],
            max: 1,
            hint: 'Espacio para selecionar',
            instructions: '↑/↓',
        },
    ]

    console.clear()
    checkNodeVersion()
    checkOs()
    const onCancel = () => {
        console.log('Proceso cancelado!')
        return true
    }
    const response = await prompts(questions, { onCancel })
    const {
        dependencies = '',
        cleanTmp = '',
        providerDb = [],
        providerWs = [],
    } = response
    /**
     * Question #1
     * @returns
     */
    const installOrUdpateDep = async () => {
        const answer = dependencies.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await installAll()
            return true
        }
    }

    /**
     * Question #2
     * @returns
     */
    const cleanAllSession = async () => {
        const answer = cleanTmp.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await cleanSession()
            return true
        }
    }

    const vendorProvider = async () => {
        if (!providerWs.length) {
            console.log(
                red(
                    `Debes de seleccionar una WS Provider. Tecla [Space] para seleccionar`
                )
            )
            process.exit(1)
        }
        console.log(yellow(`'Deberia crer una carpeta en root/provider'`))
        return true
    }

    const dbProvider = async () => {
        const answer = providerDb
        if (!providerDb.length) {
            console.log(
                red(
                    `Debes de seleccionar una DB Provider. Tecla [Space] para seleccionar`
                )
            )
            process.exit(1)
        }
        if (answer === 'json') {
            console.log('Deberia crer una carpeta en root/data')
            return 1
        }
    }

    await installOrUdpateDep()
    await cleanAllSession()
    await vendorProvider()
    await dbProvider()
    await jsonConfig()
}

module.exports = { startInteractive }
