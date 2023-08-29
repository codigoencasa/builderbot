const { generateRef } = require('../../utils/hash')

const eventButton = () => {
    return generateRef('_event_button_')
}

const REGEX_EVENT_BUTTON = /^_event_button__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

module.exports = { eventButton, REGEX_EVENT_BUTTON }
