import { utils } from '@builderbot/bot'
import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { MessengerEvents, MessengerMessage } from '../src/facebook.events'

jest.mock('@builderbot/bot', () => ({
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        generateRefProvider: jest.fn().mockImplementation((type) => `REF:${type}`),
    },
}))

describe('MessengerEvents', () => {
    let messengerEvents: MessengerEvents

    beforeEach(() => {
        jest.clearAllMocks()
        messengerEvents = new MessengerEvents()
    })

    describe('eventInMsg', () => {
        it('should ignore non-page objects', () => {
            const payload = {
                object: 'not-page',
                entry: [],
            } as MessengerMessage

            messengerEvents.eventInMsg(payload)
            expect(messengerEvents.emit).not.toHaveBeenCalled()
        })

        it('should ignore payloads without entries', () => {
            const payload = {
                object: 'page',
                entry: [],
            } as MessengerMessage

            messengerEvents.eventInMsg(payload)
            expect(messengerEvents.emit).not.toHaveBeenCalled()
        })

        it('should handle text messages', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    text: 'Hello world',
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(messengerEvents.emit).toHaveBeenCalledWith('message', {
                body: 'Hello world',
                from: 'sender_id',
                name: '',
                host: {
                    id: 'recipient_id',
                    phone: 'messenger',
                },
                timestamp: 1614714981098,
                messageId: 'message_id',
            })
        })

        it('should handle image attachments', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    attachments: [
                                        {
                                            type: 'image',
                                            payload: {
                                                url: 'https://example.com/image.jpg',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(messengerEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                })
            )
        })

        it('should handle video attachments', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    attachments: [
                                        {
                                            type: 'video',
                                            payload: {
                                                url: 'https://example.com/video.mp4',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(messengerEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                })
            )
        })

        it('should handle audio attachments', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    attachments: [
                                        {
                                            type: 'audio',
                                            payload: {
                                                url: 'https://example.com/audio.mp3',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_voice_note_')
            expect(messengerEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_voice_note_',
                })
            )
        })

        it('should handle file attachments', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    attachments: [
                                        {
                                            type: 'file',
                                            payload: {
                                                url: 'https://example.com/document.pdf',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_document_')
            expect(messengerEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_document_',
                })
            )
        })

        it('should handle location attachments', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    attachments: [
                                        {
                                            type: 'location',
                                            payload: {
                                                url: 'https://example.com/location',
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_location_')
            expect(messengerEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_location_',
                })
            )
        })

        it('should handle postback events', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                postback: {
                                    title: 'Button Title',
                                    payload: 'BUTTON_PAYLOAD',
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(messengerEvents.emit).toHaveBeenCalledWith('message', {
                body: 'BUTTON_PAYLOAD',
                from: 'sender_id',
                name: '',
                host: {
                    id: 'recipient_id',
                    phone: 'messenger',
                },
                timestamp: 1614714981098,
                messageId: `postback_${payload.entry[0].messaging[0].timestamp}`,
            })
        })

        it('should handle multiple entries and messaging events', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id_1',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id_1' },
                                recipient: { id: 'recipient_id_1' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id_1',
                                    text: 'Hello from first entry',
                                },
                            },
                        ],
                    },
                    {
                        id: 'page_id_2',
                        time: 1614714981099,
                        messaging: [
                            {
                                sender: { id: 'sender_id_2' },
                                recipient: { id: 'recipient_id_2' },
                                timestamp: 1614714981099,
                                message: {
                                    mid: 'message_id_2',
                                    text: 'Hello from second entry',
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)

            expect(messengerEvents.emit).toHaveBeenCalledTimes(2)
            expect(messengerEvents.emit).toHaveBeenNthCalledWith(
                1,
                'message',
                expect.objectContaining({
                    body: 'Hello from first entry',
                    from: 'sender_id_1',
                })
            )
            expect(messengerEvents.emit).toHaveBeenNthCalledWith(
                2,
                'message',
                expect.objectContaining({
                    body: 'Hello from second entry',
                    from: 'sender_id_2',
                })
            )
        })

        it('should ignore echo messages', () => {
            const payload: MessengerMessage = {
                object: 'page',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        messaging: [
                            {
                                sender: { id: 'sender_id' },
                                recipient: { id: 'recipient_id' },
                                timestamp: 1614714981098,
                                message: {
                                    mid: 'message_id',
                                    text: 'Echo message',
                                    is_echo: true,
                                },
                            },
                        ],
                    },
                ],
            }

            messengerEvents.eventInMsg(payload)
            expect(messengerEvents.emit).not.toHaveBeenCalled()
        })
    })
})
