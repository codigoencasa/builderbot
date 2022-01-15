const {get} = require('../adapter')

const getMessages = async (step, message) => {
    const data = await get(step)
    return data.includes(message)
}


const responseMessages = (step) => {
    switch (step) {
        case 'STEP_1':
            return ['Si como estas', '🤔'].join('')
            break;
        case 'STEP_2':
            return ['pa como estas', '🤔'].join('')
            break;
    }
    return null
}

module.exports = { getMessages, responseMessages }