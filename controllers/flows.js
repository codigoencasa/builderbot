const getMessages = (step) => {
    switch (step) {
        case 'STEP_1':
            return ['hola', 'hi']
            break;
        case 'STEP_2':
            return ['hola', 'hi']
            break;
    }
    return null
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