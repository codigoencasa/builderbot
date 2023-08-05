const { generateRef } = require('../../utils/hash')

const eventAction = () => {
    return generateRef('_event_action_')
}

module.exports = { eventAction }
