/**
 * LAYER: Domain
 * Contains: eventVoiceNote + REGEX_EVENT_VOICE_NOTE — voice-note event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventVoiceNote, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for voice-note events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventVoiceNote = (): string => {
    return generateRef('_event_voice_note_')
}

const REGEX_EVENT_VOICE_NOTE = generateRegex(`_event_voice_note`)

export { eventVoiceNote, REGEX_EVENT_VOICE_NOTE }
