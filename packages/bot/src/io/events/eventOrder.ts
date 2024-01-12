import { generateRef } from '../../utils/hash'

const eventOrder = (): string => {
    return generateRef('_event_order_')
}

const REGEX_EVENT_ORDER = /^_event_order__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

export { eventOrder, REGEX_EVENT_ORDER }
