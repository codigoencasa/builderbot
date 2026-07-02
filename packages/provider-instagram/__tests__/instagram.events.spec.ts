import { utils } from '@builderbot/bot'
import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { InstagramEvents, InstagramMessage, InstagramListenMode } from '../src/instagram.events'
import { instagramEvents as igEventsConst } from '../src/instagram.events.constants'

jest.mock('@builderbot/bot', () => ({
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        generateRefProvider: jest.fn().mockImplementation((type) => `REF:${type}`),
        setEvent: jest.fn().mockReturnValue('_mock_ig_comment_event_'),
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

        it('should not emit a user message for echo messages (emits host instead)', () => {
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

            // Echo messages are outbound (sent by the account itself), so they
            // must NOT be processed as inbound user messages...
            expect(instagramEvents.emit).not.toHaveBeenCalledWith('message', expect.anything())
            // ...but they ARE emitted as 'host' events so the CRM can track
            // outbound messages. recipient.id is the actual user (fromMe: true).
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'host',
                expect.objectContaining({
                    body: 'Echo message',
                    from: 'recipient_id',
                    fromMe: true,
                    messageId: 'message_id',
                })
            )
        })

        it('should handle comment events when listenMode is comment', () => {
            instagramEvents.setListenMode('comment')

            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        changes: [
                            {
                                field: 'comments',
                                value: {
                                    from: {
                                        id: 'commenter_id',
                                        username: 'testuser',
                                    },
                                    media: {
                                        id: 'media_123',
                                        media_product_type: 'FEED',
                                    },
                                    id: 'comment_456',
                                    text: 'Nice post!',
                                    timestamp: '2024-01-01T00:00:00+0000',
                                },
                            },
                        ],
                    },
                ],
            }

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledWith('message', {
                body: igEventsConst.IG_COMMENT,
                from: 'commenter_id',
                name: 'testuser',
                username: 'testuser',
                host: {
                    id: 'page_id',
                    phone: 'instagram',
                },
                timestamp: expect.any(Number),
                messageId: 'comment_comment_456',
                comment: {
                    id: 'comment_456',
                    parentId: null,
                    mediaId: 'media_123',
                    username: 'testuser',
                    text: 'Nice post!',
                },
            })
        })

        it('should handle comment events with parent_id (reply to comment)', () => {
            instagramEvents.setListenMode('comment')

            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        changes: [
                            {
                                field: 'comments',
                                value: {
                                    from: {
                                        id: 'commenter_id',
                                        username: 'replier',
                                    },
                                    media: {
                                        id: 'media_123',
                                    },
                                    id: 'comment_789',
                                    parent_id: 'comment_456',
                                    text: 'I agree!',
                                    timestamp: '2024-01-01T00:00:00+0000',
                                },
                            },
                        ],
                    },
                ],
            }

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: igEventsConst.IG_COMMENT,
                    comment: expect.objectContaining({
                        parentId: 'comment_456',
                        text: 'I agree!',
                    }),
                })
            )
        })

        it('should handle both messages and comments when listenMode is both', () => {
            instagramEvents.setListenMode('both')

            const payload: InstagramMessage = {
                object: 'instagram',
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
                                    text: 'Hello DM',
                                },
                            },
                        ],
                        changes: [
                            {
                                field: 'comments',
                                value: {
                                    from: {
                                        id: 'commenter_id',
                                        username: 'testuser',
                                    },
                                    media: {
                                        id: 'media_123',
                                    },
                                    id: 'comment_456',
                                    text: 'Nice!',
                                    timestamp: '2024-01-01T00:00:00+0000',
                                },
                            },
                        ],
                    },
                ],
            }

            instagramEvents.eventInMsg(payload)

            expect(instagramEvents.emit).toHaveBeenCalledTimes(2)
            expect(instagramEvents.emit).toHaveBeenCalledWith('message', expect.objectContaining({ body: 'Hello DM' }))
            expect(instagramEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: igEventsConst.IG_COMMENT,
                    comment: expect.objectContaining({ text: 'Nice!' }),
                })
            )
        })

        it('should ignore comments when listenMode is message', () => {
            instagramEvents.setListenMode('message')

            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        changes: [
                            {
                                field: 'comments',
                                value: {
                                    from: { id: 'commenter_id', username: 'testuser' },
                                    media: { id: 'media_123' },
                                    id: 'comment_456',
                                    text: 'Ignored comment',
                                    timestamp: '2024-01-01T00:00:00+0000',
                                },
                            },
                        ],
                    },
                ],
            }

            instagramEvents.eventInMsg(payload)
            expect(instagramEvents.emit).not.toHaveBeenCalled()
        })

        it('should ignore messages when listenMode is comment', () => {
            instagramEvents.setListenMode('comment')

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
                                    text: 'Ignored DM',
                                },
                            },
                        ],
                    },
                ],
            }

            instagramEvents.eventInMsg(payload)
            expect(instagramEvents.emit).not.toHaveBeenCalled()
        })

        it('should ignore non-comment changes', () => {
            instagramEvents.setListenMode('comment')

            const payload: InstagramMessage = {
                object: 'instagram',
                entry: [
                    {
                        id: 'page_id',
                        time: 1614714981098,
                        changes: [
                            {
                                field: 'mentions',
                                value: {
                                    from: { id: 'user_id' },
                                    media: { id: 'media_123' },
                                    id: 'mention_123',
                                    text: '@bot hello',
                                    timestamp: '2024-01-01T00:00:00+0000',
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
