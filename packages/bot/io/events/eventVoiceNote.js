const { generateRef } = require('../../utils/hash')

const eventVoiceNote = () => {
    return generateRef('_event_voice_note_')
}

module.exports = { eventVoiceNote }
