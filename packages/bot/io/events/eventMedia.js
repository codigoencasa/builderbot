const { generateRef } = require('../../utils/hash')

const eventMedia = () => {
    return generateRef('_event_media_')
}

const REGEX_EVENT_MEDIA = /^_event_media__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

module.exports = { eventMedia, REGEX_EVENT_MEDIA }
