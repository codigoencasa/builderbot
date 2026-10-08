import { beforeEach, describe, expect, jest, it } from '@jest/globals'

import { TikTokComment, TikTokEvents } from '../src/tiktok.events'
import { tiktokEvents as ttEventsConst } from '../src/tiktok.events.constants'

jest.mock('@builderbot/bot', () => ({
    EventEmitterClass: class {
        emit = jest.fn()
    },
    utils: {
        setEvent: jest.fn().mockReturnValue('_mock_tt_comment_event_'),
    },
}))

describe('TikTokEvents', () => {
    let tiktokEvents: TikTokEvents

    beforeEach(() => {
        jest.clearAllMocks()
        tiktokEvents = new TikTokEvents()
    })

    describe('handleComment', () => {
        it('should build a BotContext and emit it as a message event', () => {
            const comment: TikTokComment = {
                comment_id: 'comment_456',
                text: 'que buena explicación!',
                username: 'testuser',
                display_name: 'Test User',
                user_id: 'user_123',
                create_time: '1690058874',
                video_id: 'video_789',
            }

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).toHaveBeenCalledWith('message', {
                body: ttEventsConst.TT_COMMENT,
                from: 'user_123',
                name: 'Test User',
                username: 'testuser',
                host: {
                    id: 'business_abc',
                    phone: 'tiktok',
                },
                timestamp: 1690058874000,
                messageId: 'comment_comment_456',
                comment: {
                    id: 'comment_456',
                    videoId: 'video_789',
                    parentId: null,
                    username: 'testuser',
                    text: 'que buena explicación!',
                },
            })
        })

        it('should fall back to username when display_name is absent', () => {
            const comment: TikTokComment = {
                comment_id: 'comment_1',
                text: 'excelente',
                username: 'gatos_y_mas_',
                user_id: 'user_1',
                create_time: '1690000000',
                video_id: 'video_1',
            }

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ name: 'gatos_y_mas_', username: 'gatos_y_mas_' })
            )
        })

        it('should fall back to comment_id as the "from" field when user_id and username are both absent', () => {
            const comment: TikTokComment = {
                comment_id: 'comment_only_id',
                text: 'hola',
                create_time: '1690000000',
                video_id: 'video_1',
            }

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ from: 'comment_only_id' })
            )
        })

        it('should populate parentId when the comment is a reply', () => {
            const comment: TikTokComment = {
                comment_id: 'comment_789',
                parent_comment_id: 'comment_456',
                text: 'I agree!',
                username: 'replier',
                user_id: 'user_2',
                create_time: '1690000000',
                video_id: 'video_1',
            }

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({
                    comment: expect.objectContaining({ parentId: 'comment_456', text: 'I agree!' }),
                })
            )
        })

        it('should default timestamp to 0 when create_time is not parseable', () => {
            const comment: TikTokComment = {
                comment_id: 'comment_bad_time',
                text: 'hi',
                username: 'weirduser',
                user_id: 'user_3',
                create_time: 'not-a-number',
                video_id: 'video_1',
            }

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).toHaveBeenCalledWith('message', expect.objectContaining({ timestamp: 0 }))
        })

        it('should early-return when comment_id is missing', () => {
            const comment = {
                comment_id: '',
                text: 'hi',
                create_time: '100',
                video_id: 'video_1',
            } as TikTokComment

            tiktokEvents.handleComment(comment, 'business_abc')

            expect(tiktokEvents.emit).not.toHaveBeenCalled()
        })

        it('should early-return when businessId is missing', () => {
            const comment: TikTokComment = {
                comment_id: 'c1',
                text: 'hi',
                create_time: '100',
                video_id: 'video_1',
            }

            tiktokEvents.handleComment(comment, '')

            expect(tiktokEvents.emit).not.toHaveBeenCalled()
        })
    })
})
