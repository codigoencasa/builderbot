import { generateRef } from '../../utils/hash'

const eventAction = (): string => {
    return generateRef('_event_action_')
}

export { eventAction }
