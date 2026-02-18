import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'

import { GoHighLevelProvider } from '../src/gohighlevel/provider'
import { GHLGlobalVendorArgs } from '../src/types'

jest.mock('axios')
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))
jest.mock('@builderbot/bot')

const globalVendorArgs: GHLGlobalVendorArgs = {
    name: 'bot',
    clientId: 'test_client_id',
    clientSecret: 'test_client_secret',
    locationId: 'test_location_id',
    channelType: 'SMS',
    apiVersion: '2021-07-28',
    port: 3000,
    writeMyself: 'none',
    accessToken: 'test_access_token',
    refreshToken: 'test_refresh_token',
}

describe('#GoHighLevelProvider', () => {
    let provider: GoHighLevelProvider

    beforeEach(() => {
        jest.clearAllMocks()
        provider = new GoHighLevelProvider(globalVendorArgs)
    })

    describe('#constructor', () => {
        test('should initialize globalVendorArgs correctly', () => {
            expect(provider.globalVendorArgs.clientId).toBe('test_client_id')
            expect(provider.globalVendorArgs.clientSecret).toBe('test_client_secret')
            expect(provider.globalVendorArgs.locationId).toBe('test_location_id')
            expect(provider.globalVendorArgs.channelType).toBe('SMS')
            expect(provider.globalVendorArgs.apiVersion).toBe('2021-07-28')
        })

        test('should initialize tokenManager with correct credentials', () => {
            expect(provider.tokenManager).toBeDefined()
            expect(provider.tokenManager.getAccessToken()).toBe('test_access_token')
            expect(provider.tokenManager.getRefreshToken()).toBe('test_refresh_token')
        })

        test('should initialize queue', () => {
            expect(provider.queue).toBeDefined()
        })

        test('should initialize contactResolver', () => {
            expect(provider.contactResolver).toBeDefined()
        })

        test('should throw if clientId is missing', () => {
            expect(() => new GoHighLevelProvider({
                ...globalVendorArgs,
                clientId: '',
            })).toThrow('[GoHighLevel] clientId and clientSecret are required')
        })

        test('should throw if clientSecret is missing', () => {
            expect(() => new GoHighLevelProvider({
                ...globalVendorArgs,
                clientSecret: '',
            })).toThrow('[GoHighLevel] clientId and clientSecret are required')
        })

        test('should throw if locationId is missing', () => {
            expect(() => new GoHighLevelProvider({
                ...globalVendorArgs,
                locationId: '',
            })).toThrow('[GoHighLevel] locationId is required')
        })
    })

    describe('#getAuthorizationUrl', () => {
        test('should return a valid authorization URL', () => {
            const url = provider.getAuthorizationUrl()
            expect(url).toContain('marketplace.gohighlevel.com/oauth/chooselocation')
            expect(url).toContain('client_id=test_client_id')
            expect(url).toContain('response_type=code')
        })
    })

    describe('#sendMessageToApi', () => {
        test('should send message to GHL API and return response data', async () => {
            const fakeBody = {
                type: 'SMS' as const,
                contactId: 'contact_123',
                message: 'Hello, World!',
            }
            const fakeResponseData = { messageId: '123456' }
            ;(axios.post as jest.MockedFunction<typeof axios.post>).mockResolvedValue({
                data: fakeResponseData,
            })

            const responseData = await provider.sendMessageToApi(fakeBody)

            expect(axios.post).toHaveBeenCalledWith(
                'https://services.leadconnectorhq.com/conversations/messages',
                fakeBody,
                {
                    headers: {
                        Authorization: 'Bearer test_access_token',
                        Version: '2021-07-28',
                        'Content-Type': 'application/json',
                    },
                }
            )
            expect(responseData).toEqual(fakeResponseData)
        })

        test('should throw when API call fails', async () => {
            const fakeBody = {
                type: 'SMS' as const,
                contactId: 'contact_123',
                message: 'Hello!',
            }
            const error = new Error('Network error')
            ;(axios.post as jest.MockedFunction<typeof axios.post>).mockRejectedValue(error)

            await expect(provider.sendMessageToApi(fakeBody)).rejects.toThrow('Network error')
        })
    })

    describe('#sendText', () => {
        test('should resolve contactId and send text message via queue', async () => {
            jest.spyOn(provider, 'resolveContactId').mockResolvedValue('contact_123')
            jest.spyOn(provider, 'sendMessageGHL').mockResolvedValue({ success: true })

            await provider.sendText('1234567890', 'Hello, World!')

            expect(provider.resolveContactId).toHaveBeenCalledWith('1234567890')
            expect(provider.sendMessageGHL).toHaveBeenCalledWith({
                type: 'SMS',
                contactId: 'contact_123',
                message: 'Hello, World!',
            })
        })

        test('should throw error when contact not found', async () => {
            jest.spyOn(provider, 'resolveContactId').mockResolvedValue(null)

            await expect(provider.sendText('0000000000', 'Hello')).rejects.toThrow(
                'Contact not found for phone: 0000000000'
            )
        })
    })

    describe('#sendButtons', () => {
        test('should format buttons as text and send via sendText', async () => {
            jest.spyOn(provider, 'sendText').mockResolvedValue({ success: true })

            const buttons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            await provider.sendButtons('1234567890', buttons, 'Choose an option:')

            expect(provider.sendText).toHaveBeenCalledWith(
                '1234567890',
                'Choose an option:\n\n1. Option 1\n2. Option 2'
            )
        })
    })

    describe('#sendMessage', () => {
        test('should send text message when no options provided', async () => {
            jest.spyOn(provider, 'sendText').mockResolvedValue({ success: true })
            jest.spyOn(provider, 'sendButtons')
            jest.spyOn(provider, 'sendMedia')

            await provider.sendMessage('1234567890', 'Hello!', {})

            expect(provider.sendText).toHaveBeenCalledWith('1234567890', 'Hello!')
            expect(provider.sendButtons).not.toHaveBeenCalled()
            expect(provider.sendMedia).not.toHaveBeenCalled()
        })

        test('should send buttons when options.buttons is provided', async () => {
            jest.spyOn(provider, 'sendButtons').mockResolvedValue({ success: true })
            jest.spyOn(provider, 'sendText')
            jest.spyOn(provider, 'sendMedia')

            const buttons = [{ body: 'Yes' }, { body: 'No' }]
            await provider.sendMessage('1234567890', 'Confirm?', { buttons })

            expect(provider.sendButtons).toHaveBeenCalledWith('1234567890', buttons, 'Confirm?')
            expect(provider.sendText).not.toHaveBeenCalled()
            expect(provider.sendMedia).not.toHaveBeenCalled()
        })

        test('should send media when options.media is provided', async () => {
            jest.spyOn(provider, 'sendMedia').mockResolvedValue({ success: true })
            jest.spyOn(provider, 'sendText')
            jest.spyOn(provider, 'sendButtons')

            await provider.sendMessage('1234567890', 'Check this', {
                media: 'https://example.com/image.jpg',
            })

            expect(provider.sendMedia).toHaveBeenCalledWith(
                '1234567890',
                'Check this',
                'https://example.com/image.jpg'
            )
            expect(provider.sendText).not.toHaveBeenCalled()
            expect(provider.sendButtons).not.toHaveBeenCalled()
        })
    })

    describe('#sendMessageGHL', () => {
        test('should add message to queue', () => {
            const fakeBody = {
                type: 'SMS' as const,
                contactId: 'contact_123',
                message: 'Hello!',
            }
            const mockQueueAdd = jest.fn()
            provider.queue.add = mockQueueAdd

            provider.sendMessageGHL(fakeBody)

            expect(provider.queue.add).toHaveBeenCalled()
        })
    })

    describe('#busEvents', () => {
        test('#auth_failure - should emit the correct event', () => {
            const payload = { message: 'Test' }
            const mockEmit = jest.fn()
            provider.emit = mockEmit

            provider.busEvents()[0].func(payload)

            expect(mockEmit).toHaveBeenCalledWith('auth_failure', payload)
        })

        test('#notice - should emit the correct event', () => {
            const payload = { instructions: ['Test instruction'], title: 'Test title' }
            const mockEmit = jest.fn()
            provider.emit = mockEmit

            provider.busEvents()[1].func(payload)

            expect(mockEmit).toHaveBeenCalledWith('notice', payload)
        })

        test('#ready - should emit the correct event', () => {
            const mockEmit = jest.fn()
            provider.emit = mockEmit

            provider.busEvents()[2].func({} as any)

            expect(mockEmit).toHaveBeenCalledWith('ready', true)
        })

        test('#message - should emit the correct event', () => {
            const payload = { body: 'Hello', from: '123456789' }
            const mockEmit = jest.fn()
            provider.emit = mockEmit

            provider.busEvents()[3].func(payload as any)

            expect(mockEmit).toHaveBeenCalledWith('message', payload)
        })

        test('#host - should emit the correct event', () => {
            const payload = { locationId: 'test_location' }
            const mockEmit = jest.fn()
            provider.emit = mockEmit

            provider.busEvents()[4].func(payload)

            expect(mockEmit).toHaveBeenCalledWith('host', payload)
        })

        test('#tokens_updated - should update globalVendorArgs tokens', () => {
            const payload = {
                access_token: 'new_access_token',
                refresh_token: 'new_refresh_token',
            }

            provider.busEvents()[5].func(payload)

            expect(provider.globalVendorArgs.accessToken).toBe('new_access_token')
            expect(provider.globalVendorArgs.refreshToken).toBe('new_refresh_token')
        })
    })

    describe('#saveFile', () => {
        test('should return ERROR when no URL found in context', async () => {
            const ctx = {}
            const result = await provider.saveFile(ctx)
            expect(result).toBe('ERROR')
        })
    })

    describe('#resolveContactId', () => {
        test('should call contactResolver with correct params', async () => {
            jest.spyOn(provider.contactResolver, 'resolveContactId').mockResolvedValue('contact_123')

            const result = await provider.resolveContactId('+1 234-567-890')

            expect(provider.contactResolver.resolveContactId).toHaveBeenCalledWith(
                '1234567890',
                'test_location_id',
                'test_access_token'
            )
            expect(result).toBe('contact_123')
        })
    })

    describe('#stop', () => {
        test('should destroy tokenManager and clear cache', () => {
            jest.spyOn(provider.tokenManager, 'destroy')
            jest.spyOn(provider.contactResolver, 'clearCache')

            provider.stop()

            expect(provider.tokenManager.destroy).toHaveBeenCalled()
            expect(provider.contactResolver.clearCache).toHaveBeenCalled()
        })
    })
})
