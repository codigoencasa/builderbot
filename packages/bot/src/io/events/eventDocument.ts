import { generateRef, generateRegex } from '../../utils/hash'

const eventDocument = (): string => {
    return generateRef('_event_document_')
}

const REGEX_EVENT_DOCUMENT = generateRegex(`_event_document`)

export { eventDocument, REGEX_EVENT_DOCUMENT }
