import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { BaileysProvider } from '../src'
import path from 'path'
import { IStickerOptions } from 'wa-sticker-formatter'
import fs from 'fs'
import mime from 'mime-types'
import { utils } from '@builderbot/bot'
import { makeInMemoryStore, useMultiFileAuthState } from '@whiskeysockets/baileys'

const phoneNumber = '+123456789'

jest.mock('@whiskeysockets/baileys', () => ({
    downloadMediaMessage: jest.fn(),
    proto: {
        Message: {
            fromObject: jest.fn().mockReturnValue({}),
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
}))

jest.mock('fs/promises', () => ({
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
    baileyCleanNumber: jest.fn().mockImplementation(() => phoneNumber),
    baileyIsValidNumber: jest.fn((number: string) => number === '1234567890'),
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
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
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

    test('should initialize BaileysProvider correctly with default arguments', () => {
        // Arrange
        const defaultArgs = {
            name: 'bot',
            gifPlayback: false,
            usePairingCode: false,
            browser: ['Ubuntu', 'Chrome', '20.0.04'],
            timeRelease: 21600000,
            phoneNumber: null,
            useBaileysStore: true,
            port: 3000,
            writeMyself: 'none',
        }
        // Act
        const baileysProvider = new BaileysProvider({})

        // Assert
        expect(baileysProvider.globalVendorArgs).toEqual(defaultArgs)
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
        test('should return undefined when store is not present', async () => {
            // Arrange
            const mockedKey = { remoteJid: 'exampleRemoteJid', id: 'exampleId' }
            provider.store = null as any
            // Act
            const result = await provider['getMessage'](mockedKey)

            // Assert
            expect(result).toEqual({})
        })

        test('should return message when store is present', async () => {
            // Arrange
            const mockedKey = { remoteJid: 'exampleRemoteJid', id: 'exampleId' }
            provider.store = {
                loadMessage: jest.fn(),
            } as any

            // Act
            const result = await provider['getMessage'](mockedKey)

            // Assert
            expect(result).toBeUndefined()
            expect(provider?.store?.loadMessage).toHaveBeenCalledWith(mockedKey.remoteJid, mockedKey.id)
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

    describe('#sendSticker', () => {
        test('should send a sticker message', async () => {
            // Arrange
            const remoteJid = 'recipient@example.com'
            const stickerUrl = 'https://example.com/sticker.png'
            const stickerOptions: Partial<IStickerOptions> = {}
            const messages = 'Hello Word!'
            const mockSendMessage = jest.fn() as any
            provider.vendor.sendMessage = mockSendMessage
            // Act
            await provider.sendSticker(remoteJid, stickerUrl, stickerOptions, messages)

            // Assert
            expect(mockSendMessage).toHaveBeenCalledWith(remoteJid, expect.any(Buffer), { quoted: messages })
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

            // Assert
            expect(mockSendMessage).toHaveBeenCalledWith(remoteJid, expect.any(Buffer), { quoted: null })
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

            // Assert
            expect(mockSendPresenceUpdate).toHaveBeenCalledWith(WAPresence, remoteJid)
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
                remoteJid,
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
                remoteJid,
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
                remoteJid,
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
                remoteJid,
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
        test('should send poll message with correct options', async () => {
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
            expect(mockSendMessage).toHaveBeenCalled()
        })

        test('should send poll message with correct options multiselect undefined', async () => {
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
            expect(mockSendMessage).toHaveBeenCalled()
        })

        test('should send poll message with correct options multiselect true', async () => {
            // Arrange
            const numberIn = phoneNumber
            const text = 'Please vote'
            const poll = {
                options: ['Option 1', 'Option 2', 'Option 3'],
                multiselect: true,
            }

            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendSuccess

            // Act
            const result = await provider.sendPoll(numberIn, text, poll)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalled()
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
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendFile(number, filePath)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(expect.any(String), {
                document: { url: filePath },
                mimetype: mimeType,
                fileName: fileName,
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
        test('should send audio message with correct URL', async () => {
            // Arrange
            const number = phoneNumber
            const audioUrl = 'http://example.com/audio.mp3'
            const mockSendMessage = mockSendSuccess
            provider.vendor.sendMessage = mockSendMessage

            // Act
            const result = await provider.sendAudio(number, audioUrl)

            // Assert
            expect(result).toEqual('success')
            expect(mockSendMessage).toHaveBeenCalledWith(number, {
                audio: { url: audioUrl },
                ptt: true,
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
        test('Should return undefine if the type is different from notify', () => {
            // Arrange
            const message = {
                messages: [],
                type: 'other',
            }
            // Act
            const resul = provider['busEvents']()[0].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('Should return undefine if the type message is equal from EPHEMERAL_SETTING', () => {
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
            const resul = provider['busEvents']()[0].func(message)

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
            provider.store = {
                loadMessage: jest.fn(),
            } as any
            // Act
            await provider['busEvents']()[1].func([mockMessage])

            // Assert
            expect(provider.emit).toHaveBeenCalled()
        })
    })

    describe('#indexHome', () => {
        test('should send the correct image file', () => {
            // Arrange
            const mockedReadStream = jest.fn()
            const mockedFileStream = { pipe: jest.fn() }
            mockedReadStream.mockReturnValueOnce(mockedFileStream)
            require('fs').createReadStream = mockedReadStream
            const req = { params: { idBotName: 'bot123' } }
            const res = { writeHead: jest.fn(), end: jest.fn() }
            const expectedImagePath = 'ruta/esperada/bot123.qr.png'
            const mockedJoin = jest.spyOn(path, 'join')
            mockedJoin.mockReturnValueOnce(expectedImagePath)

            // Act
            provider['indexHome'](req as any, res as any, mockNext)
            // Assert
            expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' })
        })
    })

    describe('#initVendor', () => {
        test('should initialize store when useBaileysStore is true', async () => {
            // Arrange
            jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true)
            provider.globalVendorArgs.usePairingCode = true
            provider.globalVendorArgs.phoneNumber = phoneNumber
            // Act
            await provider['initVendor']()

            // Assert
            expect(useMultiFileAuthState).toHaveBeenCalled()
            expect(makeInMemoryStore).toHaveBeenCalled()
        })
    })
})
