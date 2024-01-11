import { eventAction } from './eventAction'
import { eventDocument, REGEX_EVENT_DOCUMENT } from './eventDocument'
import { eventLocation, REGEX_EVENT_LOCATION } from './eventLocation'
import { eventMedia, REGEX_EVENT_MEDIA } from './eventMedia'
import { eventOrder, REGEX_EVENT_ORDER } from './eventOrder'
import { eventTemplate, REGEX_EVENT_TEMPLATE } from './eventTemplate'
import { eventVoiceNote, REGEX_EVENT_VOICE_NOTE } from './eventVoiceNote'
import { eventWelcome } from './eventWelcome'

type EventFunctionList = {
    [key: string]: string
}

type EventFunctionRegex = {
    [key: string]: RegExp
}

const LIST_ALL: EventFunctionList = {
    WELCOME: eventWelcome(),
    MEDIA: eventMedia(),
    LOCATION: eventLocation(),
    DOCUMENT: eventDocument(),
    VOICE_NOTE: eventVoiceNote(),
    ACTION: eventAction(),
    ORDER: eventOrder(),
    TEMPLATE: eventTemplate(),
}

const LIST_REGEX: EventFunctionRegex = {
    REGEX_EVENT_DOCUMENT,
    REGEX_EVENT_LOCATION,
    REGEX_EVENT_MEDIA,
    REGEX_EVENT_VOICE_NOTE,
    REGEX_EVENT_ORDER,
    REGEX_EVENT_TEMPLATE,
}

export { LIST_ALL, LIST_REGEX }
