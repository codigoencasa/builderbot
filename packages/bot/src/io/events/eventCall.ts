import { generateRef, generateRegex } from '../../utils/hash'

const eventCall = (): string => {
    return generateRef('_event_call_')
}

const REGEX_EVENT_CALL = generateRegex(`_event_call`)

export { eventCall, REGEX_EVENT_CALL }
