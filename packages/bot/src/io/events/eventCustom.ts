import { generateRef } from '../../utils/hash'

const REGEX_EVENT_CUSTOM = /^_event_custom__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

const eventCustom = (): string => {
    return generateRef('_event_custom_')
}

export { eventCustom, REGEX_EVENT_CUSTOM }
