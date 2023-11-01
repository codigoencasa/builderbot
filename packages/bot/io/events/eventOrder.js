const { generateRef } = require('../../utils/hash')

const eventOrder = () => {
    return generateRef('_event_order_')
}

const REGEX_EVENT_ORDER = /^_event_order__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

module.exports = { eventOrder, REGEX_EVENT_ORDER }
