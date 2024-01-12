import { generateRef } from '../../utils/hash'

const eventVoiceNote = (): string => {
    return generateRef('_event_voice_note_')
}

const REGEX_EVENT_VOICE_NOTE = /^_event_voice_note__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

export { eventVoiceNote, REGEX_EVENT_VOICE_NOTE }
