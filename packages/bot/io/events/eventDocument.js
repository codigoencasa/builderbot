const { generateRef } = require('../../utils/hash')

const eventDocument = () => {
    return generateRef('_event_document_')
}

module.exports = { eventDocument }
