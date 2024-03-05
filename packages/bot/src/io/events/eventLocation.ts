import { generateRef, generateRegex } from '../../utils/hash'

const eventLocation = (): string => {
    return generateRef('_event_location_')
}

const REGEX_EVENT_LOCATION = generateRegex(`_event_location`)

export { eventLocation, REGEX_EVENT_LOCATION }
