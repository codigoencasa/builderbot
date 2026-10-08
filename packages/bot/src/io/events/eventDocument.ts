/**
 * LAYER: Domain
 * Contains: eventDocument + REGEX_EVENT_DOCUMENT — document event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventDocument, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for document events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventDocument = (): string => {
    return generateRef('_event_document_')
}

const REGEX_EVENT_DOCUMENT = generateRegex(`_event_document`)

export { eventDocument, REGEX_EVENT_DOCUMENT }
