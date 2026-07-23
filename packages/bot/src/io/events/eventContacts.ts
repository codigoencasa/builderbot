import { generateRef, generateRegex } from '../../utils/hash'

const eventContacts = (): string => {
    return generateRef('_event_contacts_')
}

const REGEX_EVENT_CONTACTS = generateRegex(`_event_contacts`)

export { eventContacts, REGEX_EVENT_CONTACTS }
