const { eventDocument } = require('./eventDocument')
const { eventLocation } = require('./eventLocation')
const { eventMedia } = require('./eventMedia')
const { eventVoiceNote } = require('./eventVoiceNote')
const { eventWelcome } = require('./eventWelcome')

const LIST_ALL = {
    WELCOME: eventWelcome(),
    MEDIA: eventMedia(),
    LOCATION: eventLocation(),
    DOCUMENT: eventDocument(),
    VOICE_NOTE: eventVoiceNote(),
}

module.exports = LIST_ALL
