/**
 * LAYER: Domain
 * Contains: eventContacts + REGEX_EVENT_CONTACTS — contacts event marker
 * Rules: Pure event-naming logic, no side effects.
 * BigO: O(1) score:5
 * keywords: [eventContacts, LIST_REGEX, FlowClass]
 * GOAL: Produce and match the marker string for contact-card events in a flow.
 */
import { generateRef, generateRegex } from '../../utils/hash'

const eventContacts = (): string => {
    return generateRef('_event_contacts_')
}

const REGEX_EVENT_CONTACTS = generateRegex(`_event_contacts`)

export { eventContacts, REGEX_EVENT_CONTACTS }
