const prompts = require('prompts');
const { installAll } = require('./install')
const { cleanSession } = require('./clean')
const { checkNodeVersion, checkOs } = require('./check')

const questions = [
    {
        type: 'text',
        name: 'dependencies',
        message: 'Quieres actualizar las librerias "whatsapp-web.js"? (Y/n)'
    },
    {
        type: 'text',
        name: 'cleanTmp',
        message: 'Quieres limpiar la session del bot? (Y/n)'
    }
];


(async () => {
    console.clear()
    checkNodeVersion()
    checkOs()
    const onCancel = prompt => {
        console.log('Proceso cancelado!');
        return true;
    }
    const response = await prompts(questions, { onCancel });
    const { dependencies = '', cleanTmp = '' } = response

    const installOrUdpateDep = async () => {
        const answer = dependencies.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await installAll()
            return true
        }
    }

    const cleanAllSession = async () => {
        const answer = cleanTmp.toLowerCase() || 'n'
        if (answer.includes('n')) return true

        if (answer.includes('y')) {
            await cleanSession()
            return true
        }
    }

    installOrUdpateDep()
    cleanAllSession()
})();