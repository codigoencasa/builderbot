import { generateRef } from '../../utils/hash'

const eventWelcome = (): string => {
    return generateRef('_event_welcome_')
}

export { eventWelcome }
