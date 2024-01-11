import { generateRef } from '../../utils/hash'

const eventTemplate = (): string => {
    return generateRef('_event_template_')
}

const REGEX_EVENT_TEMPLATE = /^_event_template__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

export { eventTemplate, REGEX_EVENT_TEMPLATE }
