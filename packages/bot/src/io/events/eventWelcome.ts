/**
 * LAYER: Domain
 * Contains: eventWelcome — welcome event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventWelcome, LIST_ALL, FlowClass]
 * GOAL: Produce the marker string that identifies a welcome event in a flow.
 */
import { generateRef } from '../../utils/hash'

const eventWelcome = (): string => {
    return generateRef('_event_welcome_')
}

export { eventWelcome }
