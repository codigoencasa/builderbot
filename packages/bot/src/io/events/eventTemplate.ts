/**
 * LAYER: Domain
 * Contains: eventTemplate + REGEX_EVENT_TEMPLATE — template event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventTemplate, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for template events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventTemplate = (): string => {
    return generateRef('_event_template_')
}

const REGEX_EVENT_TEMPLATE = generateRegex(`_event_template`)

export { eventTemplate, REGEX_EVENT_TEMPLATE }
