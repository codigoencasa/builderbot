/**
 * LAYER: Domain
 * Contains: eventCall + REGEX_EVENT_CALL — call event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventCall, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for call events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventCall = (): string => {
    return generateRef('_event_call_')
}

const REGEX_EVENT_CALL = generateRegex(`_event_call`)

export { eventCall, REGEX_EVENT_CALL }
