const { generateRef } = require('../../utils/hash')

const eventButton = () => {
    return generateRef('_event_button_')
}

module.exports = { eventButton }
