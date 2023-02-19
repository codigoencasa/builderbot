const { generateRef } = require('../../utils/hash')

const eventDocument = () => {
    return generateRef('_event_document_')
}

const REGEX_EVENT_DOCUMENT = /^_event_document__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

module.exports = { eventDocument, REGEX_EVENT_DOCUMENT }
