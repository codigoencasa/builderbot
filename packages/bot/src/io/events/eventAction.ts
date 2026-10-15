/**
 * LAYER: Domain
 * Contains: eventAction — action event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventAction, LIST_ALL, FlowClass]
 * GOAL: Produce the marker string that identifies an action event in a flow.
 */
import { generateRef } from '../../utils/hash'

const eventAction = (): string => {
    return generateRef('_event_action_')
}

export { eventAction }
