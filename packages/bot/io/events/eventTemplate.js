const { generateRef } = require('../../utils/hash')

const eventTemplate = () => {
    return generateRef('_event_template_')
}

const REGEX_EVENT_TEMPLATE = /^_event_template__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

module.exports = { eventTemplate, REGEX_EVENT_TEMPLATE }
