import { generateRef, generateRegex } from '../../utils/hash'

const eventOrder = (): string => {
    return generateRef('_event_order_')
}

const REGEX_EVENT_ORDER = generateRegex(`_event_order`)

export { eventOrder, REGEX_EVENT_ORDER }
