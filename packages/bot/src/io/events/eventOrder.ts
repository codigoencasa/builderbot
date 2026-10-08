/**
 * LAYER: Domain
 * Contains: eventOrder + REGEX_EVENT_ORDER — order event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventOrder, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for order events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventOrder = (): string => {
    return generateRef('_event_order_')
}

const REGEX_EVENT_ORDER = generateRegex(`_event_order`)

export { eventOrder, REGEX_EVENT_ORDER }
