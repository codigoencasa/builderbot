import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { eventMedia, REGEX_EVENT_MEDIA } from '../../src/io/events/eventMedia'
import { eventLocation, REGEX_EVENT_LOCATION } from '../../src/io/events/eventLocation'
import { eventDocument, REGEX_EVENT_DOCUMENT } from '../../src/io/events/eventDocument'
import { eventVoiceNote, REGEX_EVENT_VOICE_NOTE } from '../../src/io/events/eventVoiceNote'
import { eventOrder, REGEX_EVENT_ORDER } from '../../src/io/events/eventOrder'
import { eventTemplate, REGEX_EVENT_TEMPLATE } from '../../src/io/events/eventTemplate'
import { eventCall, REGEX_EVENT_CALL } from '../../src/io/events/eventCall'
import { eventAction } from '../../src/io/events/eventAction'
import { eventWelcome } from '../../src/io/events/eventWelcome'
import { eventCustom, REGEX_EVENT_CUSTOM } from '../../src/io/events/eventCustom'
import { LIST_ALL, LIST_REGEX } from '../../src/io/events/index'

// ===== eventMedia =====

test('[eventMedia] should return a string with correct prefix', () => {
    const ref = eventMedia()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_media__'), `Expected prefix _event_media__, got: ${ref}`)
})

test('[eventMedia] should return unique values on each call', () => {
    const ref1 = eventMedia()
    const ref2 = eventMedia()
    assert.is.not(ref1, ref2, 'Each call should return a unique ref')
})

test('[REGEX_EVENT_MEDIA] should match valid media event refs', () => {
    const ref = eventMedia()
    assert.ok(REGEX_EVENT_MEDIA.test(ref), `Regex should match generated ref: ${ref}`)
})

test('[REGEX_EVENT_MEDIA] should not match arbitrary strings', () => {
    assert.not.ok(REGEX_EVENT_MEDIA.test('hello'))
    assert.not.ok(REGEX_EVENT_MEDIA.test('_event_media_'))
    assert.not.ok(REGEX_EVENT_MEDIA.test('_event_location__abc'))
})

// ===== eventLocation =====

test('[eventLocation] should return a string with correct prefix', () => {
    const ref = eventLocation()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_location__'))
})

test('[eventLocation] should return unique values', () => {
    assert.is.not(eventLocation(), eventLocation())
})

test('[REGEX_EVENT_LOCATION] should match valid location event refs', () => {
    const ref = eventLocation()
    assert.ok(REGEX_EVENT_LOCATION.test(ref))
})

test('[REGEX_EVENT_LOCATION] should not match invalid strings', () => {
    assert.not.ok(REGEX_EVENT_LOCATION.test('random_string'))
    assert.not.ok(REGEX_EVENT_LOCATION.test('_event_media__12345'))
})

// ===== eventDocument =====

test('[eventDocument] should return a string with correct prefix', () => {
    const ref = eventDocument()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_document__'))
})

test('[eventDocument] should return unique values', () => {
    assert.is.not(eventDocument(), eventDocument())
})

test('[REGEX_EVENT_DOCUMENT] should match valid document event refs', () => {
    const ref = eventDocument()
    assert.ok(REGEX_EVENT_DOCUMENT.test(ref))
})

test('[REGEX_EVENT_DOCUMENT] should not match other event types', () => {
    const mediaRef = eventMedia()
    assert.not.ok(REGEX_EVENT_DOCUMENT.test(mediaRef))
})

// ===== eventVoiceNote =====

test('[eventVoiceNote] should return a string with correct prefix', () => {
    const ref = eventVoiceNote()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_voice_note__'))
})

test('[eventVoiceNote] should return unique values', () => {
    assert.is.not(eventVoiceNote(), eventVoiceNote())
})

test('[REGEX_EVENT_VOICE_NOTE] should match valid voice note refs', () => {
    const ref = eventVoiceNote()
    assert.ok(REGEX_EVENT_VOICE_NOTE.test(ref))
})

test('[REGEX_EVENT_VOICE_NOTE] should not match other event types', () => {
    assert.not.ok(REGEX_EVENT_VOICE_NOTE.test(eventMedia()))
    assert.not.ok(REGEX_EVENT_VOICE_NOTE.test('plain_text'))
})

// ===== eventOrder =====

test('[eventOrder] should return a string with correct prefix', () => {
    const ref = eventOrder()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_order__'))
})

test('[eventOrder] should return unique values', () => {
    assert.is.not(eventOrder(), eventOrder())
})

test('[REGEX_EVENT_ORDER] should match valid order event refs', () => {
    const ref = eventOrder()
    assert.ok(REGEX_EVENT_ORDER.test(ref))
})

// ===== eventTemplate =====

test('[eventTemplate] should return a string with correct prefix', () => {
    const ref = eventTemplate()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_template__'))
})

test('[eventTemplate] should return unique values', () => {
    assert.is.not(eventTemplate(), eventTemplate())
})

test('[REGEX_EVENT_TEMPLATE] should match valid template event refs', () => {
    const ref = eventTemplate()
    assert.ok(REGEX_EVENT_TEMPLATE.test(ref))
})

// ===== eventCall =====

test('[eventCall] should return a string with correct prefix', () => {
    const ref = eventCall()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_call__'))
})

test('[eventCall] should return unique values', () => {
    assert.is.not(eventCall(), eventCall())
})

test('[REGEX_EVENT_CALL] should match valid call event refs', () => {
    const ref = eventCall()
    assert.ok(REGEX_EVENT_CALL.test(ref))
})

test('[REGEX_EVENT_CALL] should not match other events', () => {
    assert.not.ok(REGEX_EVENT_CALL.test(eventMedia()))
    assert.not.ok(REGEX_EVENT_CALL.test('hello'))
})

// ===== eventAction =====

test('[eventAction] should return a string with correct prefix', () => {
    const ref = eventAction()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_action__'))
})

test('[eventAction] should return unique values', () => {
    assert.is.not(eventAction(), eventAction())
})

// ===== eventWelcome =====

test('[eventWelcome] should return a string with correct prefix', () => {
    const ref = eventWelcome()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_welcome__'))
})

test('[eventWelcome] should return unique values', () => {
    assert.is.not(eventWelcome(), eventWelcome())
})

// ===== eventCustom =====

test('[eventCustom] should return a string with correct prefix', () => {
    const ref = eventCustom()
    assert.type(ref, 'string')
    assert.ok(ref.startsWith('_event_custom__'))
})

test('[eventCustom] should return unique values', () => {
    assert.is.not(eventCustom(), eventCustom())
})

test('[REGEX_EVENT_CUSTOM] should match valid custom event refs', () => {
    const ref = eventCustom()
    assert.ok(REGEX_EVENT_CUSTOM.test(ref))
})

test('[REGEX_EVENT_CUSTOM] should not match invalid strings', () => {
    assert.not.ok(REGEX_EVENT_CUSTOM.test('not_an_event'))
    assert.not.ok(REGEX_EVENT_CUSTOM.test('_event_custom_no_uuid'))
})

// ===== LIST_ALL =====

test('[LIST_ALL] should export all event types', () => {
    assert.ok(LIST_ALL.WELCOME, 'Should have WELCOME')
    assert.ok(LIST_ALL.MEDIA, 'Should have MEDIA')
    assert.ok(LIST_ALL.LOCATION, 'Should have LOCATION')
    assert.ok(LIST_ALL.DOCUMENT, 'Should have DOCUMENT')
    assert.ok(LIST_ALL.VOICE_NOTE, 'Should have VOICE_NOTE')
    assert.ok(LIST_ALL.ACTION, 'Should have ACTION')
    assert.ok(LIST_ALL.ORDER, 'Should have ORDER')
    assert.ok(LIST_ALL.TEMPLATE, 'Should have TEMPLATE')
    assert.ok(LIST_ALL.CALL, 'Should have CALL')
})

test('[LIST_ALL] each event should be a unique string', () => {
    const values = Object.values(LIST_ALL)
    const uniqueValues = new Set(values)
    assert.equal(values.length, uniqueValues.size, 'All events should be unique')
})

// ===== LIST_REGEX =====

test('[LIST_REGEX] should export all regex patterns', () => {
    assert.instance(LIST_REGEX.REGEX_EVENT_DOCUMENT, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_LOCATION, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_MEDIA, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_VOICE_NOTE, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_ORDER, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_TEMPLATE, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_CUSTOM, RegExp)
    assert.instance(LIST_REGEX.REGEX_EVENT_CALL, RegExp)
})

// ===== Cross-event regex isolation =====

test('[Cross-event] each regex should only match its own event type', () => {
    const eventPairs = [
        { gen: eventMedia, regex: REGEX_EVENT_MEDIA, name: 'media' },
        { gen: eventLocation, regex: REGEX_EVENT_LOCATION, name: 'location' },
        { gen: eventDocument, regex: REGEX_EVENT_DOCUMENT, name: 'document' },
        { gen: eventVoiceNote, regex: REGEX_EVENT_VOICE_NOTE, name: 'voice_note' },
        { gen: eventOrder, regex: REGEX_EVENT_ORDER, name: 'order' },
        { gen: eventTemplate, regex: REGEX_EVENT_TEMPLATE, name: 'template' },
        { gen: eventCall, regex: REGEX_EVENT_CALL, name: 'call' },
        { gen: eventCustom, regex: REGEX_EVENT_CUSTOM, name: 'custom' },
    ]

    for (const pair of eventPairs) {
        const ref = pair.gen()
        // Should match its own regex
        assert.ok(pair.regex.test(ref), `${pair.name} should match its own regex`)

        // Should NOT match other regexes
        for (const other of eventPairs) {
            if (other.name !== pair.name) {
                assert.not.ok(
                    other.regex.test(ref),
                    `${pair.name} ref should NOT match ${other.name} regex`
                )
            }
        }
    }
})

test.run()
