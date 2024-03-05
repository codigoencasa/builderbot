import { generateRef, generateRegex } from '../../utils/hash'

const eventTemplate = (): string => {
    return generateRef('_event_template_')
}

const REGEX_EVENT_TEMPLATE = generateRegex(`_event_template`)

export { eventTemplate, REGEX_EVENT_TEMPLATE }
