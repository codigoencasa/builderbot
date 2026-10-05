import { utils } from '@builderbot/bot'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { useMultiFileAuthState } from 'baileys'
import { EventEmitter } from 'events'
import fs from 'fs'
import mime from 'mime-types'
import path from 'path'
import { IStickerOptions } from 'wa-sticker-formatter'

import { BaileysProvider } from '../src'
import * as baileysUtils from '../src/utils'

const phoneNumber = '+123456789'

jest.mock('baileys', () => ({
    downloadMediaMessage: jest.fn(),
    proto: {
        Message: {
            fromObject: jest.fn().mockReturnValue({}),
            create: jest.fn().mockReturnValue({}),
        },
    },
    useMultiFileAuthState: jest.fn().mockImplementation(() => ({
        state: { creds: {}, keys: {} },
        saveCreds: jest.fn(),
    })),

    makeInMemoryStore: jest.fn().mockReturnValue({
        readFromFile: jest.fn(),
        writeToFile: jest.fn(),
        bind: jest.fn(),
    }),
    makeWASocketOther: jest.fn().mockImplementation(() => ({
        ev: { on: jest.fn() },
        authState: { creds: { registered: false } },
        waitForConnectionUpdate: jest.fn(),
        requestPairingCode: jest.fn(),
    })),
    getAggregateVotesInPollMessage: jest.fn().mockReturnValue([{ name: 'Option 1', voters: ['voter1'] }]),
    Browsers: {
        appropriate: jest.fn().mockReturnValue(['Windows', 'Chrome', 'Chrome 114.0.5735.198']),
    },
}))

jest.mock('fs/promises', () => ({
    ...jest.requireActual<typeof import('fs/promises')>('fs/promises'),
    readFile: jest.fn().mockImplementation(() => Promise.resolve(Buffer.from('audio-buffer') as any)),
    writeFile: jest.fn(),
}))

jest.mock('wa-sticker-formatter', () => {
    return {
        Sticker: jest.fn().mockImplementation(() => ({
            toMessage: jest.fn().mockImplementation(() => Buffer.from('sticker-buffer')),
        })),
    }
})

jest.mock('../src/utils', () => ({
    // Real group/broadcast JIDs must pass through so T15 routing can be asserted;
    // everything else keeps the legacy stubbed phone number.
    baileyCleanNumber: jest
        .fn()
        .mockImplementation((number: string) =>
            number?.includes('@g.us') || number?.includes('broadcast') ? number : phoneNumber
        ),
    baileyIsValidNumber: jest.fn((number: string) => {
        if (!number || number.trim() === '') return false
        return !number.includes('@g.us')
    }),
    baileyCleanNumberWithLid: jest
        .fn()
        .mockImplementation((key: any) => key?.remoteJid || key?.senderPn || 'mocked-number'),
    baileyGenerateImage: jest.fn(),
    emptyDirSessions: jest.fn(),
}))

const mimeType = 'text/plain'

jest.mock('mime-types', () => ({
    lookup: jest.fn().mockImplementation(() => mimeType),
    extension: jest.fn().mockImplementation(() => '.png'),
}))

jest.mock('@builderbot/bot')

const mockSendSuccess = jest.fn().mockImplementation(() => 'success') as any

describe('#BaileysProvider', () => {
    let provider: BaileysProvider
    let mockRes: any
    let mockReq: any
    let mockNext: any

    beforeEach(() => {
        const args = {
            name: 'test-bot',
            gifPlayback: true,
            usePairingCode: true,
            browser: ['Windows', 'Chrome', 'Chrome 114.0.5735.198'] as any,
            phoneNumber: '+123456789',
            useBaileysStore: true,
            port: 3001,
        }

        provider = new BaileysProvider(args)
        mockReq = {}
        mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            pipe: jest.fn(),
        }
        mockNext = jest.fn()
        provider.vendor = jest.fn() as any
    })

    afterEach(async () => {
        await provider.destroy()
        jest.restoreAllMocks()
    })

    test('should initialize BaileysProvider correctly with default arguments', async () => {
        // Arrange
        const defaultArgs = {
            name: 'bot',
            gifPlayback: false,
            usePairingCode: false,
            browser: ['Windows', 'Chrome', 'Chrome 114.0.5735.198'] as any,
            timeRelease: 0,
            phoneNumber: null,
            useBaileysStore: true,
            groupsIgnore: true,
            allowGroups: false,
            readStatus: false,
            port: 3000,
            autoRefresh: 0,
            writeMyself: 'none',
            experimentalStore: false,
            experimentalSyncMessage: undefined,
            fallBackAction: undefined,
            captureProcessSignals: false,
        }
        // Act
        const baileysProvider = new BaileysProvider({})

        // Assert
        expect(baileysProvider.globalVendorArgs).toEqual(defaultArgs)
        await baileysProvider.destroy()
    })

    describe('#beforeHttpServerInit', () => {
        test('beforeHttpServerInit - you should configure middleware to handle HTTP requests', () => {
            // Arrange
            const mockUse = jest.fn().mockReturnThis()
            const mockGet = jest.fn()

            const mockPolka = jest.fn(() => ({
                use: mockUse,
                get: mockGet,
            }))

            provider.server = mockPolka() as any
            // Act
            provider['beforeHttpServerInit']()

            // Assert
            expect(mockUse).toHaveBeenCalled()
            const middleware = mockUse.mock.calls[0][0] as any
            expect(middleware).toBeInstanceOf(Function)
            middleware(mockReq, mockRes, mockNext)
            expect(mockReq.globalVendorArgs).toBe(provider.globalVendorArgs)
            expect(mockGet).toHaveBeenCalledWith('/', provider.indexHome)
        })
    })

    describe('#getMessage', () => {
        // H3 fixed in Phase 2: Baileys expects `undefined` on a cache miss
        // (`getMessage: (key) => Promise<proto.IMessage | undefined>`); a truthy
        // `{}` made Baileys believe the message was found.
        test('should return undefined on cache miss', async () => {
            const result = await provider['getMessage']({ remoteJid: 'exampleRemoteJid', id: 'exampleId' })
            expect(result).toBeUndefined()
        })

        test('should return undefined when key has no id', async () => {
            const result = await provider['getMessage']({ remoteJid: 'exampleRemoteJid', id: '' })
            expect(result).toBeUndefined()
        })

        test('should return the cached message on hit', async () => {
            const message = { conversation: 'cached' } as any
            provider.messageCache?.set('msg:hit-id', message)
            const result = await provider['getMessage']({ remoteJid: 'exampleRemoteJid', id: 'hit-id' })
            expect(result).toBe(message)
        })

        test('should cache outgoing messages so retries can find them', async () => {
            const sent = { key: { id: 'out-1' }, message: { conversation: 'hello' } }
            provider.vendor = { sendMessage: (jest.fn() as any).mockResolvedValue(sent) } as any
            await provider.sendText('123@s.whatsapp.net', 'hello')
            const result = await provider['getMessage']({ remoteJid: '123@s.whatsapp.net', id: 'out-1' })
            expect(result).toEqual({ conversation: 'hello' })
        })
    })

    describe('#saveFile', () => {
        test('should save a file and return the path whit path', async () => {
            // Arrange
            const ctx: any = {
                key: {},
                message: null,
            }
            const options = { path: '/tmp' }
            const getMimeTypeSpy = jest.spyOn(provider, 'getMimeType' as any).mockReturnValue('image/jpeg')
            const generateFileNameSpy = jest.spyOn(provider, 'generateFileName' as any).mockReturnValue('file.jpeg')
            jest.spyOn(path, 'join').mockImplementation(() => '/tmp/mock-file.jpeg')

            // Act
            const filePath = await provider.saveFile(ctx, options)

            // Assert
            expect(getMimeTypeSpy).toHaveBeenCalled()
            expect(generateFileNameSpy).toHaveBeenCalled()
            expect(filePath).toContain('mock-file.jpeg')
            expect(path.isAbsolute(filePath)).toBe(true)
        })

        test('should save a file and return the path', async () => {
            // Arrange
            const ctx: any = {
                key: {},
                message: null,
            }
            const getMimeTypeSpy = jest.spyOn(provider, 'getMimeType' as any).mockReturnValue('image/jpeg')
            const generateFileNameSpy = jest.spyOn(provider, 'generateFileName' as any).mockReturnValue('file.jpeg')
            jest.spyOn(path, 'join').mockImplementation(() => '/tmp/mock-file.jpeg')

            // Act
            const filePath = await provider.saveFile(ctx)

            // Assert
            expect(getMimeTypeSpy).toHaveBeenCalled()
            expect(generateFileNameSpy).toHaveBeenCalled()
            expect(filePath).toContain('mock-file.jpeg')
            expect(path.isAbsolute(filePath)).toBe(true)
        })

        test('should pass reuploadRequest ctx to downloadMediaMessage (T5, upstream #2767)', async () => {
            const { downloadMediaMessage } = jest.mocked(await import('baileys'))
            const ctx: any = { key: { id: 'media-1' }, message: { imageMessage: { mimetype: 'image/jpeg' } } }
            provider.vendor = { updateMediaMessage: jest.fn() } as any
            jest.spyOn(provider, 'generateFileName' as any).mockReturnValue('file.jpeg')

            await provider.saveFile(ctx, { path: '/tmp' })

            expect(downloadMediaMessage).toHaveBeenCalledWith(
                ctx,
                'buffer',
                {},
                expect.objectContaining({ reuploadRequest: expect.any(Function) })
            )
        })

        test('should throw an error when MIME type is not found', async () => {
            // Arrange
            const mockContext = { message: {} }
            const getMimeTypeSpy = jest.spyOn(provider, 'getMimeType' as any).mockReturnValue(null)

            // Act
            const response = provider.saveFile(mockContext)

            //  Assert
            await expect(response).rejects.toThrow('MIME type not found')
            expect(getMimeTypeSpy).toHaveBeenCalled()
        })
    })

    describe('#generateFileName', () => {
        test('should generate a unique filename with the provided extension', () => {
            // Arrange
            const extension = 'jpg'
            // Act
            const fileName = provider['generateFileName'](extension)
            // Assert
            expect(fileName).toMatch(/^file-\d+\.(jpg)$/)
        })
    })

    describe('#getMimeType', () => {
        test('should return the file type image/jpeg ', () => {
            // Arrange
            const mockMessage = {
                message: {
                    imageMessage: {
                        mimetype: 'image/jpeg',
                    },
                },
            }

            // Act
            const mimeType = provider['getMimeType'](mockMessage as any)

            // Assert
            expect(mimeType).toBe('image/jpeg')
        })

        test('should return the file type video/mp4 ', () => {
            // Arrange
            const mockMessage = {
                message: {
                    videoMessage: {
                        mimetype: 'video/mp4',
                    },
                },
            }

            // Act
            const mimeType = provider['getMimeType'](mockMessage as any)

            // Assert
            expect(mimeType).toBe('video/mp4')
        })

        test('should return the file type application/pdf ', () => {
            // Arrange
            const mockMessage = {
                message: {
                    documentMessage: {
                        mimetype: 'application/pdf',
                    },
                },
            }

            // Act
            const mimeType = provider['getMimeType'](mockMessage as any)

            // Assert
            expect(mimeType).toBe('application/pdf')
        })

        test('should return undefined if message is not available', () => {
            // Arrange
            const mockMessage = {}

            // Act
            const mimeType = provider['getMimeType'](mockMessage as any)

            // Assert
            expect(mimeType).toBeUndefined()
        })
    })

    describe('#send* destination normalization (T16)', () => {
        test('sendImage normalizes a bare phone number into a JID', async () => {
            const mockSendMessage = jest.fn() as any
            provider.vendor.sendMessage = mockSendMessage
            const cleanSpy = jest.mocked(baileysUtils.baileyCleanNumber)
            cleanSpy.mockClear()

            await provider.sendImage('15551230000', '/tmp/pic.png', 'caption')

            // A bare number must be converted before Baileys calls jidDecode()
            expect(cleanSpy).toHaveBeenCalledWith('15551230000')
            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                expect.objectContaining({ image: { url: '/tmp/pic.png' }, caption: 'caption' })
            )
        })

        test('sendText normalizes a bare phone number into a JID', async () => {
            const mockSendMessage = jest.fn() as any
            provider.vendor.sendMessage = mockSendMessage

            await provider.sendText('15551230000', 'hola')

            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, { text: 'hola' })
        })

        test('sendFile normalizes a bare phone number into a JID', async () => {
            const mockSendMessage = jest.fn() as any
            provider.vendor.sendMessage = mockSendMessage

            await provider.sendFile('15551230000', '/tmp/doc.pdf', 'caption')

            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                expect.objectContaining({ document: { url: '/tmp/doc.pdf' }, caption: 'caption' })
            )
        })
    })

    describe('#sendSticker', () => {
        test('should send a sticker message', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const stickerUrl = 'https://example.com/sticker.png'
            const stickerOptions: Partial<IStickerOptions> = {}
            const messages = 'Hello Word!'
            const sentMessage = { key: { id: 'sticker-1' }, message: { stickerMessage: {} } }
            const mockSendMessage = (jest.fn() as any).mockResolvedValue(sentMessage)
            provider.vendor.sendMessage = mockSendMessage
            // Act
            const sent = await provider.sendSticker(remoteJid, stickerUrl, stickerOptions, messages)

            // Assert — the destination is normalized before hitting Baileys
            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, expect.any(Buffer), { quoted: messages })
            // T16: stickers now return the sent message and cache it for getMessage retries
            expect(sent).toBe(sentMessage)
            expect(await provider['getMessage']({ remoteJid, id: 'sticker-1' })).toBe(sentMessage.message)
        })

        test('should send a sticker message null', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const stickerUrl = 'https://example.com/sticker.png'
            const stickerOptions: Partial<IStickerOptions> = {}
            const mockSendMessage = jest.fn() as any
            provider.vendor.sendMessage = mockSendMessage
            // Act
            await provider.sendSticker(remoteJid, stickerUrl, stickerOptions)

            // Assert — the destination is normalized before hitting Baileys
            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, expect.any(Buffer), { quoted: null })
        })
    })

    describe('#sendPresenceUpdate', () => {
        test('should send a presence update', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const WAPresence = 'recording'
            const mockSendPresenceUpdate = jest.fn() as any
            provider.vendor.sendPresenceUpdate = mockSendPresenceUpdate

            // Act
            await provider.sendPresenceUpdate(remoteJid, WAPresence)

            // Assert — the destination is normalized before hitting Baileys
            expect(mockSendPresenceUpdate).toHaveBeenCalledWith(WAPresence, phoneNumber)
        })
    })

    describe('#sendContact', () => {
        test('should send a contact message', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const contactNumber = '+1234567890'
            const displayName = 'John Doe'
            const orgName = 'My Company'
            const messages = 'Hello Word!'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendContact(
                remoteJid,
                { replaceAll: () => contactNumber },
                displayName,
                orgName,
                messages
            )

            // Assert
            expect(result).toEqual({ status: 'success' })
            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                {
                    contacts: {
                        displayName: '.',
                        contacts: [
                            {
                                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nORG:${orgName};\nTEL;type=CELL;type=VOICE;waid=${contactNumber.replace(
                                    '+',
                                    ''
                                )}:${contactNumber}\nEND:VCARD`,
                            },
                        ],
                    },
                },
                { quoted: messages }
            )
        })

        test('should send a contact message null', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const contactNumber = '+1234567890'
            const displayName = 'John Doe'
            const orgName = 'My Company'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendContact(
                remoteJid,
                { replaceAll: () => contactNumber },
                displayName,
                orgName
            )

            // Assert
            expect(result).toEqual({ status: 'success' })
            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                {
                    contacts: {
                        displayName: '.',
                        contacts: [
                            {
                                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nORG:${orgName};\nTEL;type=CELL;type=VOICE;waid=${contactNumber.replace(
                                    '+',
                                    ''
                                )}:${contactNumber}\nEND:VCARD`,
                            },
                        ],
                    },
                },
                { quoted: null }
            )
        })
    })

    describe('#sendLocation', () => {
        test('should send a location message', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const latitude = 123.456
            const longitude = 789.012
            const messages = 'Hello Word!'

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendLocation(remoteJid, latitude, longitude, messages)

            // Assert
            expect(result).toEqual({ status: 'success' })
            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                {
                    location: {
                        degreesLatitude: latitude,
                        degreesLongitude: longitude,
                    },
                },
                { quoted: messages }
            )
        })

        test('should send a location message null', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const latitude = 123.456
            const longitude = 789.012

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendLocation(remoteJid, latitude, longitude)

            // Assert
            expect(result).toEqual({ status: 'success' })
            expect(mockSendMessage).toHaveBeenCalledWith(
                phoneNumber,
                {
                    location: {
                        degreesLatitude: latitude,
                        degreesLongitude: longitude,
                    },
                },
                { quoted: null }
            )
        })
    })

    describe('#sendMessage', () => {
        test('should send text message if no options provided', async () => {
            // Arrange
            const numberIn = phoneNumber
            const message = 'Hello, world!'
            const options = {}

            const mockSendText = mockSendSuccess
            provider.sendText = mockSendText

            // Act
            const result = await provider.sendMessage(numberIn, message, options)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendText).toHaveBeenCalledWith(numberIn, message)
        })

        test('should send text message when options is undefined (T4)', async () => {
            const mockSendText = mockSendSuccess
            provider.sendText = mockSendText

            const result = await provider.sendMessage(phoneNumber, 'Hello, world!')

            expect(result).toEqual('success')
            expect(mockSendText).toHaveBeenCalledWith(phoneNumber, 'Hello, world!')
        })

        test('should send buttons if options contain buttons', async () => {
            // Arrange
            const numberIn = phoneNumber
            const message = 'Please select an option'
            const options = {
                buttons: [{ body: 'Option 1' }, { body: 'Option 2' }],
            }

            const mockSendButtons = mockSendSuccess
            provider.sendButtons = mockSendButtons

            // Act
            const result = await provider.sendMessage(numberIn, message, options)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendButtons).toHaveBeenCalledWith(numberIn, message, options.buttons)
        })

        test('should send media if options contain media', async () => {
            // Arrange
            const numberIn = phoneNumber
            const message = 'Please see the attached media'
            const mediaUrl = 'https://example.com/image.jpg'
            const options = {
                media: mediaUrl,
            }

            const mockSendMedia = mockSendSuccess
            provider.sendMedia = mockSendMedia

            // Act
            const result = await provider.sendMessage(numberIn, message, options)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMedia).toHaveBeenCalledWith(numberIn, mediaUrl, message)
        })
    })

    describe('#sendPoll', () => {
        test('should send poll message with multiselect false (selectableCount 0)', async () => {
            // Arrange
            const numberIn = phoneNumber
            const text = 'Please vote'
            const poll = {
                options: ['Option 1', 'Option 2', 'Option 3'],
                multiselect: false,
            }

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendPoll(numberIn, text, poll)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, {
                poll: { name: text, values: poll.options, selectableCount: 0 },
            })
        })

        test('should send poll message with multiselect undefined (selectableCount 1)', async () => {
            // Arrange
            const numberIn = phoneNumber
            const text = 'Please vote'
            const poll = {
                options: ['Option 1', 'Option 2', 'Option 3'],
                multiselect: undefined,
            }

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendPoll(numberIn, text, poll)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, {
                poll: { name: text, values: poll.options, selectableCount: 1 },
            })
        })

        test('should send poll message with multiselect true (selectableCount 1)', async () => {
            // Arrange
            const numberIn = phoneNumber
            const text = 'Please vote'
            const poll = {
                options: ['Option 1', 'Option 2', 'Option 3'],
                multiselect: true,
            }

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendPoll(numberIn, text, poll)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(phoneNumber, {
                poll: { name: text, values: poll.options, selectableCount: 1 },
            })
        })

        test('should return false if options length is less than 2', async () => {
            // Arrange
            const numberIn = phoneNumber
            const text = 'Please vote'
            const poll = {
                options: ['Option 1'],
                multiselect: false,
            }

            // Act
            const result = await provider.sendPoll(numberIn, text, poll)

            // Assert
            expect(result).toBeFalsy()
        })
    })

    describe('#sendButtons', () => {
        test('should emit notice event with correct details', async () => {
            // Arrange
            const number = phoneNumber
            const text = 'Button message'
            const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]

            const mockEmit = jest.fn()
            provider.emit = mockEmit
            provider.vendor.sendMessage = mockSendSuccess
            // Act
            await provider.sendButtons(number, text, buttons)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('notice', {
                title: 'DEPRECATED',
                instructions: [
                    'Currently sending buttons is not available with this provider',
                    'this function is available with Meta or Twilio',
                ],
            })
        })

        test('should send button message with correct details', async () => {
            // Arrange
            const number = phoneNumber
            const text = 'Button message'
            const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]

            // Mock del método sendMessage
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendButtons(number, text, buttons)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), {
                text,
                footer: '',
                buttons: [
                    { buttonId: 'id-btn-0', buttonText: { displayText: 'Button 1' }, type: 1 },
                    { buttonId: 'id-btn-1', buttonText: { displayText: 'Button 2' }, type: 1 },
                ],
                headerType: 1,
            })
        })
    })

    describe('#sendFile', () => {
        test('should send file message with correct MIME type and file name', async () => {
            // Arrange
            const number = phoneNumber
            const filePath = '/path/to/file/example.txt'
            const mimeType = 'text/plain'
            const fileName = 'example.txt'
            const caption = 'Hello Word'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendFile(number, filePath, caption)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), {
                document: { url: filePath },
                mimetype: mimeType,
                fileName: fileName,
                caption,
            })
        })
    })

    describe('#sendText', () => {
        test('should send text message with correct content', async () => {
            // Arrange
            const number = phoneNumber
            const message = 'This is a test message'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendText(number, message)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, { text: message })
        })
    })

    describe('#sendAudio ', () => {
        test('should send audio message as buffer with ptt=true by default', async () => {
            // Arrange
            const number = phoneNumber
            const audioPath = '/tmp/audio.opus'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendAudio(number, audioPath)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, {
                audio: Buffer.from('audio-buffer'),
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus',
            })
        })

        test('should send audio message with isPTT=false when specified', async () => {
            // Arrange
            const number = phoneNumber
            const audioPath = '/tmp/audio.opus'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendAudio(number, audioPath, false)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, {
                audio: Buffer.from('audio-buffer'),
                ptt: false,
                mimetype: 'audio/ogg; codecs=opus',
            })
        })
    })

    describe('#sendVideo', () => {
        test('should send video message with correct file path and text', async () => {
            // Arrange
            const number = phoneNumber
            const filePath = '/path/to/video.mp4'
            const text = 'This is a video message'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('sticker-buffer'))
            // Act
            const result = await provider.sendVideo(number, filePath, text)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, {
                video: expect.any(Buffer),
                caption: text,
                gifPlayback: provider.globalVendorArgs.gifPlayback,
            })
        })
    })

    describe('#sendImage', () => {
        test('should send image message with correct file path and text', async () => {
            // Arrange
            const number = phoneNumber
            const filePath = '/path/to/image.jpg'
            const text = 'This is an image message'

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendImage(number, filePath, text)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, {
                image: { url: filePath },
                caption: text,
            })
        })
    })

    describe('#sendMedia', () => {
        test('should send image when provided with image URL', async () => {
            // Arrange
            const number = '+123456789'
            const imageUrl = 'https://example.com/image.jpg'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/image.jpg'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('image/jpeg')
            const sendImageSpy = jest.spyOn(provider, 'sendImage').mockImplementation(async () => undefined)

            // Act
            await provider.sendMedia(number, imageUrl, text)

            // Assert
            expect(sendImageSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(imageUrl)
        })

        test('should send video when provided with video URL', async () => {
            // Arrange
            const number = '+123456789'
            const videoUrl = 'https://example.com/video.mp4'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/audio.mp3'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('video/mp4')
            const sendVideoSpy = jest.spyOn(provider, 'sendVideo').mockImplementation(async () => undefined)

            // Act
            await provider.sendMedia(number, videoUrl, text)
            // Assert
            expect(sendVideoSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(videoUrl)
        })

        test('should send audio when provided with audio URL', async () => {
            // Arrange
            const number = '+123456789'
            const audioUrl = 'https://example.com/audio.mp3'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/audio.mp3'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('audio/mp3')
            const sendAudioSpy = jest.spyOn(provider, 'sendAudio').mockImplementation(async () => undefined)
            // Act
            await provider.sendMedia(number, audioUrl, text)

            // Assert
            expect(sendAudioSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(audioUrl)
        })

        test('should send file when provided with file URL', async () => {
            // Arrange
            const number = '+123456789'
            const fileUrl = 'https://example.com/test.pdf'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/test.pdf'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('text/plain')
            const sendFileSpy = jest.spyOn(provider, 'sendFile').mockImplementation(async () => undefined)
            // Act
            await provider.sendMedia(number, fileUrl, text)

            // Assert
            expect(sendFileSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(fileUrl)
        })
    })

    describe('#busEvents - messages.upsert ', () => {
        test('Should return undefine if the type is different from notify', async () => {
            // Arrange
            const message = {
                messages: [],
                type: 'other',
            }
            // Act
            const resul = await provider['busEvents']()[0].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('Should return undefine if the type message is equal from EPHEMERAL_SETTING', async () => {
            // Arrange
            const message = {
                messages: [
                    {
                        message: {
                            protocolMessage: {
                                type: 'EPHEMERAL_SETTING',
                            },
                        },
                    },
                ],
                type: 'notify',
            }
            // Act
            const resul = await provider['busEvents']()[0].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('Detect location in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    locationMessage: {
                        degreesLatitude: 40.7128,
                        degreesLongitude: -74.006,
                    },
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: phoneNumber,
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detect video in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    videoMessage: {
                        url: 'https://example.com/video.mp4',
                    },
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: 'remoteJid',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })
            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detect sticker in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    stickerMessage: {},
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: 'remoteJid',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detectar imagen en un mensaje', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    imageMessage: {},
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: 'remoteJid',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detect file in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    documentMessage: {},
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: 'remoteJid',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detect voice memo in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    audioMessage: {},
                },
                pushName: 'Sender Name',
                key: {
                    remoteJid: 'remoteJid',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('Detect orderMessage with standard JID', async () => {
            // Arrange
            jest.mocked(utils.generateRefProvider).mockReturnValue('_event_order___mock-uuid')

            const mockMessage = {
                message: {
                    orderMessage: { orderId: 'order-123', token: 'token-abc' },
                },
                pushName: 'Buyer Name',
                key: {
                    remoteJid: '5491112223344@s.whatsapp.net',
                    id: 'msg-order-001',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ body: '_event_order___mock-uuid' })
            )
        })

        test('Detect orderMessage with @lid JID and no remoteJidAlt', async () => {
            // Arrange — escenario del bug: @lid sin remoteJidAlt crasheaba baileyCleanNumber(undefined)
            jest.mocked(utils.generateRefProvider).mockReturnValue('_event_order___mock-uuid')

            const mockMessage = {
                message: {
                    orderMessage: { orderId: 'order-456', token: 'token-xyz' },
                },
                pushName: 'Buyer Name',
                key: {
                    remoteJid: '5491112223344@lid',
                    remoteJidAlt: undefined,
                    id: 'msg-order-002',
                },
            }

            // Act
            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalledWith(
                'message',
                expect.objectContaining({ body: '_event_order___mock-uuid' })
            )
        })

        test('LID without remoteJidAlt keeps the @lid JID instead of fabricating a PN (T3)', async () => {
            const cleanSpy = jest.mocked(baileysUtils.baileyCleanNumber)
            cleanSpy.mockClear()

            const mockMessage = {
                message: { conversation: 'hola' },
                pushName: 'LID User',
                key: { remoteJid: '999000123456789@lid', remoteJidAlt: undefined, id: 'lid-msg-1' },
            }

            await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // First normalization call must receive the raw @lid JID, never the
            // fabricated numeric prefix '999000123456789'.
            expect(cleanSpy).toHaveBeenCalledWith('999000123456789@lid')
            expect(cleanSpy).not.toHaveBeenCalledWith('999000123456789')
        })

        test('three identical messages emit exactly one event (T2)', async () => {
            const emitSpy = jest.spyOn(provider, 'emit')
            const build = () => ({
                message: { conversation: 'duplicated' },
                pushName: 'User',
                key: { remoteJid: '15550000001@s.whatsapp.net', id: 'dup-id-1', fromMe: false },
            })

            const upsert = provider['busEvents']()[0].func
            await upsert({ messages: [build()], type: 'notify' })
            await upsert({ messages: [build()], type: 'notify' })
            await upsert({ messages: [build()], type: 'notify' })

            const messageEvents = emitSpy.mock.calls.filter(
                ([event, payload]: any[]) => event === 'message' && payload?.key?.id === 'dup-id-1'
            )
            expect(messageEvents).toHaveLength(1)
        })

        test('a repeated message is accepted again after the dedupe TTL expires (T2)', async () => {
            jest.useFakeTimers()
            try {
                const emitSpy = jest.spyOn(provider, 'emit')
                const build = () => ({
                    message: { conversation: 'later' },
                    pushName: 'User',
                    key: { remoteJid: '15550000002@s.whatsapp.net', id: 'dup-id-2', fromMe: false },
                })
                const upsert = provider['busEvents']()[0].func
                await upsert({ messages: [build()], type: 'notify' })
                jest.advanceTimersByTime(5 * 60 * 1000 + 1)
                await upsert({ messages: [build()], type: 'notify' })

                const messageEvents = emitSpy.mock.calls.filter(
                    ([event, payload]: any[]) => event === 'message' && payload?.key?.id === 'dup-id-2'
                )
                expect(messageEvents).toHaveLength(2)
            } finally {
                jest.useRealTimers()
            }
        })

        test('group message is discarded when allowGroups is false (default, T15)', async () => {
            const emitSpy = jest.spyOn(provider, 'emit')
            const groupMessage = {
                message: { conversation: 'hola grupo' },
                pushName: 'Member',
                key: { remoteJid: '120363000000000000@g.us', id: 'grp-off-1', fromMe: false, participant: '1@lid' },
            }

            await provider['busEvents']()[0].func({ messages: [groupMessage], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'grp-off-1')
            expect(events).toHaveLength(0)
        })

        test('group message is delivered with from=group JID and participant when allowGroups is true (T15)', async () => {
            provider.globalVendorArgs.allowGroups = true
            const emitSpy = jest.spyOn(provider, 'emit')
            const groupMessage = {
                message: { conversation: 'hola grupo' },
                pushName: 'Member',
                key: {
                    remoteJid: '120363000000000000@g.us',
                    id: 'grp-on-1',
                    fromMe: false,
                    participant: '15551230000@s.whatsapp.net',
                },
            }

            await provider['busEvents']()[0].func({ messages: [groupMessage], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'grp-on-1')
            expect(events).toHaveLength(1)
            expect(events[0][1]).toEqual(
                expect.objectContaining({
                    from: '120363000000000000@g.us',
                    participant: '15551230000@s.whatsapp.net',
                    sender: '15551230000@s.whatsapp.net',
                })
            )
        })

        test('exposes the chat counterpart username when WhatsApp sends one', async () => {
            const emitSpy = jest.spyOn(provider, 'emit')
            const message = {
                message: { conversation: 'hola' },
                pushName: 'Tia',
                key: {
                    remoteJid: '122299361538159@lid',
                    remoteJidAlt: undefined,
                    remoteJidUsername: 'meow1222',
                    id: 'uname-1',
                    fromMe: false,
                },
            }

            await provider['busEvents']()[0].func({ messages: [message], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'uname-1')
            expect(events).toHaveLength(1)
            // `from` is normalized by baileyCleanNumber (mocked here); the username
            // must survive untouched regardless of the JID form.
            expect(events[0][1].username).toBe('meow1222')
        })

        test('exposes the participant username in group messages (allowGroups)', async () => {
            provider.globalVendorArgs.allowGroups = true
            const emitSpy = jest.spyOn(provider, 'emit')
            const message = {
                message: { conversation: '.info' },
                pushName: 'Tia',
                key: {
                    remoteJid: '120363410123779747@g.us',
                    remoteJidAlt: undefined,
                    fromMe: false,
                    participant: '122299361538159@lid',
                    participantAlt: undefined,
                    participantUsername: 'meow1222',
                    id: 'uname-grp-1',
                },
            }

            await provider['busEvents']()[0].func({ messages: [message], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'uname-grp-1')
            expect(events).toHaveLength(1)
            expect(events[0][1]).toEqual(
                expect.objectContaining({
                    from: '120363410123779747@g.us',
                    participant: '122299361538159@lid',
                    participantUsername: 'meow1222',
                })
            )
        })

        test('leaves username undefined when WhatsApp does not send one', async () => {
            const emitSpy = jest.spyOn(provider, 'emit')
            const message = {
                message: { conversation: 'sin username' },
                key: { remoteJid: '15550000003@s.whatsapp.net', id: 'uname-none-1', fromMe: false },
            }

            await provider['busEvents']()[0].func({ messages: [message], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'uname-none-1')
            expect(events).toHaveLength(1)
            expect(events[0][1].username).toBeUndefined()
            expect(events[0][1].participantUsername).toBeUndefined()
        })

        test('exposes fromMe at the payload root', async () => {
            const emitSpy = jest.spyOn(provider, 'emit')
            const incoming = {
                message: { conversation: 'de otro' },
                key: { remoteJid: '15550000004@s.whatsapp.net', id: 'fromme-0', fromMe: false },
            }
            const own = {
                message: { conversation: 'propio' },
                key: { remoteJid: '15550000005@s.whatsapp.net', id: 'fromme-1', fromMe: true },
            }

            await provider['busEvents']()[0].func({ messages: [incoming], type: 'notify' })
            provider.globalVendorArgs.writeMyself = 'both'
            await provider['busEvents']()[0].func({ messages: [own], type: 'notify' })

            const byId = (id: string) => emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === id)
            expect(byId('fromme-0')).toHaveLength(1)
            expect(byId('fromme-0')[0][1].fromMe).toBe(false)
            expect(byId('fromme-1')).toHaveLength(1)
            expect(byId('fromme-1')[0][1].fromMe).toBe(true)
        })

        test('emits _event_contacts_ ref for contact cards (W2)', async () => {
            // Note: '@builderbot/bot' is automocked in this suite, so
            // utils.generateRefProvider returns undefined; assert the call instead.
            const { utils } = jest.requireMock('@builderbot/bot') as any
            utils.generateRefProvider.mockClear()
            const emitSpy = jest.spyOn(provider, 'emit')
            const single = {
                message: { contactMessage: { displayName: 'Bob', vcard: 'BEGIN:VCARD' } },
                key: { remoteJid: '15550000006@s.whatsapp.net', id: 'contact-1', fromMe: false },
            }
            const multiple = {
                message: { contactsArrayMessage: { displayName: '2 contactos', contacts: [] } },
                key: { remoteJid: '15550000006@s.whatsapp.net', id: 'contact-2', fromMe: false },
            }

            await provider['busEvents']()[0].func({ messages: [single, multiple], type: 'notify' })

            const byId = (id: string) => emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === id)
            expect(byId('contact-1')).toHaveLength(1)
            expect(byId('contact-2')).toHaveLength(1)
            const refCalls = utils.generateRefProvider.mock.calls.map(([prefix]: any[]) => prefix)
            expect(refCalls.filter((p: string) => p === '_event_contacts_')).toHaveLength(2)
        })

        test('allowGroups does not enable broadcasts (T15)', async () => {
            provider.globalVendorArgs.allowGroups = true
            const emitSpy = jest.spyOn(provider, 'emit')
            const broadcast = {
                message: { conversation: 'status' },
                key: { remoteJid: 'status@broadcast', id: 'bcast-1', fromMe: false },
            }

            await provider['busEvents']()[0].func({ messages: [broadcast], type: 'notify' })

            const events = emitSpy.mock.calls.filter(([, p]: any[]) => p?.key?.id === 'bcast-1')
            expect(events).toHaveLength(0)
        })

        test('Detect broadcast in a message', async () => {
            // Arrange
            const mockMessage = {
                message: {},
                key: {
                    remoteJid: 'status@broadcast',
                },
            }

            // Act
            const response = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(response).toBeUndefined()
        })

        test('Invalid number', async () => {
            // Arrange
            const mockMessage = {
                pushName: 'Usuario1',
                key: {
                    remoteJid: 'remoteJid',
                },
                message: {
                    extendedTextMessage: {
                        text: 'Hola, ¿cómo estás?',
                    },
                },
                from: '0987654321',
            }
            // Act
            const response = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(response).toBeUndefined()
        })

        test('btnCtx definite', async () => {
            // Arrange
            const mockMessage = {
                pushName: 'Usuario1',
                key: {
                    remoteJid: '1234567890',
                },
                from: '1234567890',
                message: {
                    buttonsResponseMessage: {
                        selectedDisplayText: 'Texto del botón',
                    },
                },
            }
            // Act
            provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('listRowId definite', async () => {
            // Arrange
            const mockMessage = {
                message: {
                    listResponseMessage: {
                        title: 'Título de la lista',
                    },
                },
                key: {
                    remoteJid: '1234567890',
                },
                from: '1234567890',
            }

            // Act
            provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })

        test('should call fallBackAction when defined and messageStubParameters contains Invalid', async () => {
            // Arrange
            const mockFallBackAction = jest.fn() as any
            provider.globalVendorArgs.fallBackAction = mockFallBackAction

            const mockMessage = {
                messageStubParameters: ['Invalid session token'],
                key: {
                    remoteJid: '1234567890',
                    id: 'message123',
                },
                pushName: 'Test User',
            }

            // Act
            const result = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(mockFallBackAction).toHaveBeenCalledWith(mockMessage)
            expect(result).toBeUndefined() // Should return early
        })

        test('should not call fallBackAction when not defined and messageStubParameters contains Invalid', async () => {
            // Arrange
            provider.globalVendorArgs.fallBackAction = undefined
            provider.globalVendorArgs.experimentalSyncMessage = undefined

            const mockMessage = {
                messageStubParameters: ['Invalid MAC signature'],
                key: {
                    remoteJid: '1234567890@s.whatsapp.net',
                    id: 'message123',
                },
                pushName: 'Test User',
            }

            // Act
            const result = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(result).toBeUndefined() // Should return early without calling any action
        })

        test('should call experimentalSyncMessage when fallBackAction is not defined but experimentalSyncMessage is defined for Invalid messages', async () => {
            // Arrange
            provider.globalVendorArgs.fallBackAction = undefined
            provider.globalVendorArgs.experimentalSyncMessage = 'Sync message test'

            const remoteJid = '1234567890@s.whatsapp.net'
            const mockMessage = {
                messageStubParameters: ['Invalid protocol'],
                key: {
                    remoteJid: remoteJid,
                    id: 'message123',
                },
                pushName: 'Test User',
            }

            // Ensure mapSet doesn't have the remoteJid already (for fresh test)
            if (provider['mapSet'].has(remoteJid)) {
                provider['mapSet'].delete(remoteJid)
            }

            const mockSendMessage = jest.fn()
            provider.vendor = {
                sendMessage: mockSendMessage,
            } as any

            // Act
            const result = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            // Note: readMessages was removed in Baileys v7 to prevent bans
            expect(mockSendMessage).toHaveBeenCalledWith(remoteJid, { text: 'Sync message test' })
            expect(result).toBeUndefined()
        })

        test('should not process Invalid messages when fallBackAction is defined but message is from group', async () => {
            // Arrange
            const mockFallBackAction = jest.fn() as any
            provider.globalVendorArgs.fallBackAction = mockFallBackAction

            const mockMessage = {
                messageStubParameters: ['Invalid session'],
                key: {
                    remoteJid: '1234567890@g.us', // Group message
                    id: 'message123',
                },
                pushName: 'Test User',
            }

            // Act
            const result = await provider['busEvents']()[0].func({ messages: [mockMessage], type: 'notify' })

            // Assert
            expect(mockFallBackAction).toHaveBeenCalledWith(mockMessage)
            expect(result).toBeUndefined()
        })
    })

    describe('busEvents - messages.update', () => {
        test('Survey update received', async () => {
            // Arrange
            const mockPollUpdate = {
                pollUpdates: [],
            }
            const mockMessage = {
                key: {
                    remoteJid: 'remoto123',
                },
                update: mockPollUpdate,
            }

            // Mock getAggregateVotesInPollMessage
            const originalGetAggregateVotes = require('baileys').getAggregateVotesInPollMessage
            require('baileys').getAggregateVotesInPollMessage = jest.fn().mockReturnValue({})

            try {
                // Act
                await provider['busEvents']()[1].func([mockMessage])

                // Assert
                expect(provider.emit).toHaveBeenCalled()
            } finally {
                // Restore original function
                require('baileys').getAggregateVotesInPollMessage = originalGetAggregateVotes
            }
        })
    })

    describe('#indexHome', () => {
        test('should send the correct image file', () => {
            // Arrange
            const mockedFileStream = Object.assign(new EventEmitter(), { pipe: jest.fn(), destroy: jest.fn() })
            jest.spyOn(fs, 'createReadStream').mockReturnValue(mockedFileStream as any)
            const req = { params: { idBotName: 'bot123' } }
            const res = { writeHead: jest.fn(), end: jest.fn(), once: jest.fn() }
            const expectedImagePath = 'ruta/esperada/bot123.qr.png'
            const mockedJoin = jest.spyOn(path, 'join')
            mockedJoin.mockReturnValueOnce(expectedImagePath)

            // Act
            provider['indexHome'](req as any, res as any, mockNext)
            mockedFileStream.emit('open', 1)
            // Assert
            expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' })

            mockedJoin.mockRestore()
        })

        // BUG(H4): a missing QR file used to crash the process because
        // createReadStream fails asynchronously and had no error listener.
        test('should return the 404 page when the QR file does not exist', () => {
            // Arrange
            const fileStream = Object.assign(new EventEmitter(), { pipe: jest.fn(), destroy: jest.fn() })
            jest.spyOn(fs, 'createReadStream').mockReturnValue(fileStream as any)
            const req = { params: { idBotName: 'bot123' } }
            const res = { writeHead: jest.fn(), end: jest.fn(), headersSent: false, once: jest.fn() }

            // Act
            provider['indexHome'](req as any, res as any, mockNext)
            fileStream.emit('error', new Error('ENOENT'))

            // Assert
            expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'text/html' })
            expect(res.end).toHaveBeenCalled()
        })
    })

    describe('#initVendor', () => {
        test('should initialize when useBaileysStore is true', async () => {
            // Arrange
            jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
            provider.globalVendorArgs.usePairingCode = true
            provider.globalVendorArgs.phoneNumber = phoneNumber

            // Act
            await provider['initVendor']()

            // Assert
            expect(useMultiFileAuthState).toHaveBeenCalled()
            // Store is no longer used, so we don't check for makeInMemoryStore
        })
    })
})
