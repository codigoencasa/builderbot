import { generateRef, generateRegex } from '../../utils/hash'

const eventVoiceNote = (): string => {
    return generateRef('_event_voice_note_')
}

const REGEX_EVENT_VOICE_NOTE = generateRegex(`_event_voice_note`)

export { eventVoiceNote, REGEX_EVENT_VOICE_NOTE }
