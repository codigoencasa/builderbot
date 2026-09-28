/**
 * LAYER: Domain
 * Contains: eventMedia + REGEX_EVENT_MEDIA — media event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventMedia, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for media events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventMedia = (): string => {
    return generateRef('_event_media_')
}

const REGEX_EVENT_MEDIA = generateRegex(`_event_media`)

export { eventMedia, REGEX_EVENT_MEDIA }
