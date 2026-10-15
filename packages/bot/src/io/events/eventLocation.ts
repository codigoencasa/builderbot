/**
 * LAYER: Domain
 * Contains: eventLocation + REGEX_EVENT_LOCATION — location event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventLocation, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for location events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventLocation = (): string => {
    return generateRef('_event_location_')
}

const REGEX_EVENT_LOCATION = generateRegex(`_event_location`)

export { eventLocation, REGEX_EVENT_LOCATION }
