import { generateRef } from '../../utils/hash'

const eventMedia = (): string => {
    return generateRef('_event_media_')
}

const REGEX_EVENT_MEDIA = /^_event_media__[\w\d]{8}-(?:[\w\d]{4}-){3}[\w\d]{12}$/

export { eventMedia, REGEX_EVENT_MEDIA }
