import { generateRef, generateRegex } from '../../utils/hash'

const eventMedia = (): string => {
    return generateRef('_event_media_')
}

const REGEX_EVENT_MEDIA = generateRegex(`_event_media`)

export { eventMedia, REGEX_EVENT_MEDIA }
