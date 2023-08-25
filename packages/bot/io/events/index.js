const { eventDocument, REGEX_EVENT_DOCUMENT } = require('./eventDocument')
const { eventLocation, REGEX_EVENT_LOCATION } = require('./eventLocation')
const { eventMedia, REGEX_EVENT_MEDIA } = require('./eventMedia')
const { eventVoiceNote, REGEX_EVENT_VOICE_NOTE } = require('./eventVoiceNote')
const { eventButton, REGEX_EVENT_BUTTON } = require('./eventButton')
const { eventWelcome } = require('./eventWelcome')
const { eventAction } = require('./eventAction')
/**
  ✨ 2023-08-23: 
 *     Añadida la lógica para implementar EVENTS.BUTTON para reaccionar cuando se reciba la pulsación de un botón en el webhook
 */
const LIST_ALL = {
    WELCOME: eventWelcome(),
    BUTTON: eventButton(),
    MEDIA: eventMedia(),
    LOCATION: eventLocation(),
    DOCUMENT: eventDocument(),
    VOICE_NOTE: eventVoiceNote(),
    ACTION: eventAction(),
}

const LIST_REGEX = {
    REGEX_EVENT_BUTTON,
    REGEX_EVENT_DOCUMENT,
    REGEX_EVENT_LOCATION,
    REGEX_EVENT_MEDIA,
    REGEX_EVENT_VOICE_NOTE,
}

module.exports = { LIST_ALL, LIST_REGEX }
