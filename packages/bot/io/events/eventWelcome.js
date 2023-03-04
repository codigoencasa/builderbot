const { generateRef } = require('../../utils/hash')

const eventWelcome = () => {
    return generateRef('_event_welcome_')
}

module.exports = { eventWelcome }
