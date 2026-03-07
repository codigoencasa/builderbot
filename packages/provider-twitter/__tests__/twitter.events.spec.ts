import { utils } from '@builderbot/bot'
import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { TwitterEvents } from '../src/twitter.events'

jest.mock('@builderbot/bot', () => ({
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        generateRefProvider: jest.fn().mockImplementation((type) => `REF:${type}`),
    },
}))

describe('TwitterEvents', () => {
    let twitterEvents: TwitterEvents

    beforeEach(() => {
        jest.clearAllMocks()
        twitterEvents = new TwitterEvents()
    })

    describe('eventInMsg - Direct Messages', () => {
        it('should ignore payloads without DM or mention events', () => {
            twitterEvents.eventInMsg({ for_user_id: '123' })
            expect(twitterEvents.emit).not.toHaveBeenCalled()
        })

        it('should handle a text DM', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_create',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'bot_123' },
                            sender_id: 'user_456',
                            message_data: {
                                text: 'Hello from DM!',
                            },
                        },
                    },
                ],
                users: {
                    user_456: {
                        id_str: 'user_456',
                        name: 'Test User',
                        screen_name: 'testuser',
                    },
                },
            }

            twitterEvents.eventInMsg(payload)

            expect(twitterEvents.emit).toHaveBeenCalledWith('message', {
                body: 'Hello from DM!',
                from: 'user_456',
                name: 'testuser',
                host: { id: 'bot_123', phone: 'twitter' },
                timestamp: 1614714981098,
                messageId: 'event_1',
            })
        })

        it('should ignore DMs sent by the bot itself', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_create',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'user_456' },
                            sender_id: 'bot_123',
                            message_data: { text: 'Bot reply' },
                        },
                    },
                ],
                users: {},
            }

            twitterEvents.eventInMsg(payload)
            expect(twitterEvents.emit).not.toHaveBeenCalled()
        })

        it('should ignore events with non message_create type', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_delete',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'bot_123' },
                            sender_id: 'user_456',
                            message_data: { text: 'deleted' },
                        },
                    },
                ],
                users: {},
            }

            twitterEvents.eventInMsg(payload)
            expect(twitterEvents.emit).not.toHaveBeenCalled()
        })

        it('should handle DM with photo attachment', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_create',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'bot_123' },
                            sender_id: 'user_456',
                            message_data: {
                                text: '',
                                attachment: {
                                    type: 'media',
                                    media: {
                                        id_str: 'media_1',
                                        media_url_https: 'https://pbs.twimg.com/media/photo.jpg',
                                        type: 'photo',
                                    },
                                },
                            },
                        },
                    },
                ],
                users: {
                    user_456: { id_str: 'user_456', name: 'Test User', screen_name: 'testuser' },
                },
            }

            twitterEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                    data: {
                        media: {
                            url: 'https://pbs.twimg.com/media/photo.jpg',
                            type: 'photo',
                        },
                    },
                })
            )
        })

        it('should handle DM with video attachment', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_create',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'bot_123' },
                            sender_id: 'user_456',
                            message_data: {
                                text: '',
                                attachment: {
                                    type: 'media',
                                    media: {
                                        id_str: 'media_1',
                                        media_url_https: 'https://pbs.twimg.com/media/video.mp4',
                                        type: 'video',
                                    },
                                },
                            },
                        },
                    },
                ],
                users: {
                    user_456: { id_str: 'user_456', name: 'Test User', screen_name: 'testuser' },
                },
            }

            twitterEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ body: 'REF:_event_media_' })
            )
        })

        it('should use screen_name as the message name', () => {
            const payload = {
                for_user_id: 'bot_123',
                direct_message_events: [
                    {
                        type: 'message_create',
                        id: 'event_1',
                        created_timestamp: '1614714981098',
                        message_create: {
                            target: { recipient_id: 'bot_123' },
                            sender_id: 'user_456',
                            message_data: { text: 'Hi' },
                        },
                    },
                ],
                users: {
                    user_456: { id_str: 'user_456', name: 'Full Name', screen_name: 'handle' },
                },
            }

            twitterEvents.eventInMsg(payload)

            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ name: 'handle' })
            )
        })
    })

    describe('eventInMsg - Mentions', () => {
        it('should handle a mention/tweet', () => {
            const payload = {
                for_user_id: 'bot_123',
                tweet_create_events: [
                    {
                        id_str: 'tweet_1',
                        created_at: 'Mon Mar 01 12:00:00 +0000 2021',
                        text: '@bothandle Hello!',
                        user: {
                            id_str: 'user_456',
                            name: 'Test User',
                            screen_name: 'testuser',
                        },
                        in_reply_to_status_id_str: null,
                    },
                ],
            }

            twitterEvents.eventInMsg(payload)

            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: '@bothandle Hello!',
                    from: 'user_456',
                    name: 'testuser',
                    host: { id: 'bot_123', phone: 'twitter' },
                    messageId: 'tweet_1',
                    data: expect.objectContaining({
                        tweetId: 'tweet_1',
                        isReply: false,
                    }),
                })
            )
        })

        it('should ignore tweets from the bot itself', () => {
            const payload = {
                for_user_id: 'bot_123',
                tweet_create_events: [
                    {
                        id_str: 'tweet_1',
                        created_at: 'Mon Mar 01 12:00:00 +0000 2021',
                        text: 'Bot post',
                        user: { id_str: 'bot_123', name: 'Bot', screen_name: 'bot' },
                    },
                ],
            }

            twitterEvents.eventInMsg(payload)
            expect(twitterEvents.emit).not.toHaveBeenCalled()
        })

        it('should flag tweet as reply when in_reply_to_status_id_str is set', () => {
            const payload = {
                for_user_id: 'bot_123',
                tweet_create_events: [
                    {
                        id_str: 'tweet_2',
                        created_at: 'Mon Mar 01 12:00:00 +0000 2021',
                        text: '@bothandle reply text',
                        user: { id_str: 'user_456', name: 'User', screen_name: 'user' },
                        in_reply_to_status_id_str: 'tweet_0',
                    },
                ],
            }

            twitterEvents.eventInMsg(payload)

            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    data: expect.objectContaining({ isReply: true }),
                })
            )
        })

        it('should use full_text when available', () => {
            const payload = {
                for_user_id: 'bot_123',
                tweet_create_events: [
                    {
                        id_str: 'tweet_1',
                        created_at: 'Mon Mar 01 12:00:00 +0000 2021',
                        text: 'truncated...',
                        full_text: '@bothandle full text of the tweet here',
                        user: { id_str: 'user_456', name: 'User', screen_name: 'user' },
                    },
                ],
            }

            twitterEvents.eventInMsg(payload)

            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ body: '@bothandle full text of the tweet here' })
            )
        })

        it('should handle tweet with photo', () => {
            const payload = {
                for_user_id: 'bot_123',
                tweet_create_events: [
                    {
                        id_str: 'tweet_1',
                        created_at: 'Mon Mar 01 12:00:00 +0000 2021',
                        text: '@bothandle look at this',
                        user: { id_str: 'user_456', name: 'User', screen_name: 'user' },
                        extended_entities: {
                            media: [
                                {
                                    media_url_https: 'https://pbs.twimg.com/media/img.jpg',
                                    type: 'photo',
                                },
                            ],
                        },
                    },
                ],
            }

            twitterEvents.eventInMsg(payload)

            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(twitterEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    body: 'REF:_event_media_',
                    data: expect.objectContaining({
                        media: {
                            url: 'https://pbs.twimg.com/media/img.jpg',
                            type: 'photo',
                        },
                    }),
                })
            )
        })
    })
})
