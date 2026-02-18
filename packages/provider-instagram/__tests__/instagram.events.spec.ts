import { utils } from '@builderbot/bot'
import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { InstagramEvents, InstagramMessage } from '../src/instagram.events'

jest.mock('@builderbot/bot', () => ({
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        generateRefProvider: jest.fn().mockImplementation((type) => `REF:${type}`),
    },
}))

describe('InstagramEvents', () => {
    let instagramEvents: InstagramEvents

    beforeEach(() => {
        jest.clearAllMocks()
        instagramEvents = new InstagramEvents()
    })

    describe('eventInMsg', () => {
        it('should ignore non-instagram objects', () => {
            const payload = {
                object: 'not-instagram',
                entry: [],
            } as InstagramMessage

            instagramEvents.eventInMsg(payload)
            expect(instagramEvents.emit).not.toHaveBeenCalled()
        })

        it('should ignore payloads without entries', () => {
            const payload = {
                object: 'instagram',
                entry: [],
            } as InstagramMessage

            instagramEvents.eventInMsg(payload)
            expect(instagramEvents.emit).not.toHaveBeenCalled()
        })

        it('should handle text messages', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledWith('message', {
                body: 'Hello world',
                from: 'sender_id',
                name: '',
                host: {
                    id: 'recipient_id',
                    phone: 'instagram',
                },
                timestamp: 1614714981098,
                messageId: 'message_id',
            })
        })

        it('should handle image attachments', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                })
            )
        })

        it('should handle video attachments', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                })
            )
        })

        it('should handle audio attachments', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_voice_note_')
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_voice_note_',
                })
            )
        })

        it('should handle file attachments', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_document_')
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_document_',
                })
            )
        })

        it('should handle postback events', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledWith('message', {
                body: 'BUTTON_PAYLOAD',
                from: 'sender_id',
                name: '',
                host: {
                    id: 'recipient_id',
                    phone: 'instagram',
                },
                timestamp: 1614714981098,
                messageId: `postback_${payload.entry[0].messaging[0].timestamp}`,
            })
        })

        it('should handle multiple entries and messaging events', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id_1',
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
                        id: 'ig_id_2',
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

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledTimes(2)
            expect(instagramEvents.emit).toHaveBeenNthCalledWith(
                1,
                'message',
                expect.objectContaining({
                    body: 'Hello from first entry',
                    from: 'sender_id_1',
                })
            )
            expect(instagramEvents.emit).toHaveBeenNthCalledWith(
                2,
                'message',
                expect.objectContaining({
                    body: 'Hello from second entry',
                    from: 'sender_id_2',
                })
            )
        })

        it('should ignore echo messages', () => {
            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'ig_id',
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

            instagramEvents.eventInMsg(payload)
            expect(instagramEvents.emit).not.toHaveBeenCalled()
        })
    })
})
