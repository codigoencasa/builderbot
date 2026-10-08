/**
 * LAYER: Domain
 * Contains: eventCustom + REGEX_EVENT_CUSTOM — custom event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventCustom, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for custom events in a flow.
 */
import { generateRef } from '../../utils/hash'

const REGEX_EVENT_CUSTOM = /^_event_custom__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

const eventCustom = (): string => {
    return generateRef('_event_custom_')
}

export { eventCustom, REGEX_EVENT_CUSTOM }
