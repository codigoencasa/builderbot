import { describe, expect, test, jest, beforeEach } from '@jest/globals'
import { utils } from '@builderbot/bot'
import { TwilioProvider } from '../src/twilio/provider'
import { TwilioCoreVendor } from '../src/twilio/core'

jest.mock('twilio', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue({
        messages: {
            create: jest.fn(),
        },
    }),
}))

jest.mock('@builderbot/bot')

describe('#TwilioProvider', () => {
    let twilioProvider: TwilioProvider
    let mockRes: any
    let mockReq: any
    let mockNext: any

    beforeEach(() => {
        const globalVendorArgs = {
            accountSid: 'mockAccountSid',
            authToken: 'mockAuthToken',
            vendorNumber: 'mockVendorNumber',
        }
        twilioProvider = new TwilioProvider(globalVendorArgs)

        mockReq = {}
        mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            pipe: jest.fn(),
        }
        mockNext = jest.fn()
    })

    describe('#constructor', () => {
        test('constructor should initialize globalVendorArgs', () => {
            // Assert
            expect(twilioProvider.globalVendorArgs).toEqual({
                accountSid: 'mockAccountSid',
                authToken: 'mockAuthToken',
                vendorNumber: 'mockVendorNumber',
                name: 'bot',
                port: 3000,
                writeMyself: 'none',
            })
        })
    })

    describe('#saveFile', () => {
        test('should save a file received via Twilio', async () => {
            // Arrange
            const ctx = { MediaUrl0: 'mockMediaUrl' }
            const options = { path: 'mockPath' }
            const fileDownloaded = 'path/to/downloaded/image.jpg'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )

            // Act
            const result = await twilioProvider.saveFile(ctx, options)

            // Assert
            expect(result).toEqual(fileDownloaded)
            expect(utils.generalDownload).toHaveBeenCalled()
        })

        test('should save a file in tmp directory', async () => {
            // Arrange
            const ctx = { MediaUrl0: 'mockMediaUrl' }
            const fileDownloaded = 'path/to/downloaded/image.jpg'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )

            // Act
            const result = await twilioProvider.saveFile(ctx)

            // Assert
            expect(result).toEqual(fileDownloaded)
        })

        test('should handle error when generalDownload fails', async () => {
            // Arrange
            const ctx = { MediaUrl0: 'mockMediaUrl' }
            const mockError = new Error('Download failed')
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockRejectedValue(mockError)
            const consoleLogSpy = jest.spyOn(console, 'log')
            // Act
            const result = await twilioProvider.saveFile(ctx)

            // Assert
            expect(result).toBe('ERROR')
            expect(consoleLogSpy).toHaveBeenCalledWith('[Error]:', mockError)
        })
    })

    describe('#sendMessage', () => {
        test('should parse the recipient number and send media message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Here is a media file'
            const fakeMedia = 'path/to/media.jpg'
            const fakeOptions = { media: fakeMedia }
            jest.spyOn(twilioProvider, 'sendButtons')
            jest.spyOn(twilioProvider, 'sendMedia').mockResolvedValue(() => null)

            // Act
            await twilioProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(twilioProvider.sendMedia).toHaveBeenCalledWith(fakeRecipient, fakeMessage, fakeMedia)
            expect(twilioProvider.sendButtons).not.toHaveBeenCalled()
        })

        test('should send a message without media or buttons via Twilio', async () => {
            // Arrange
            const number = '123456789'
            const message = 'Test message'
            const mockTwilioResponse = {}
            jest.spyOn(twilioProvider, 'sendButtons')
            const fakeButtons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const fakeOptions = { buttons: fakeButtons }
            const mockCreate = jest.fn().mockImplementation(() => mockTwilioResponse)
            const mockTwilio = {
                twilio: { messages: { create: mockCreate } },
            }
            twilioProvider.vendor = mockTwilio as any

            // Act
            const result = await twilioProvider.sendMessage(number, message, fakeOptions)

            // Assert
            expect(result).toEqual(mockTwilioResponse)
            expect(mockCreate).toHaveBeenCalled()
            expect(twilioProvider.sendButtons).toHaveBeenCalled()
        })
    })

    describe('#sendButtons ', () => {
        test('should emit a notice event with button instructions', async () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            await twilioProvider.sendButtons()

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('notice', {
                title: '📃 INFO 📃',
                instructions: [
                    `Twilio presents a different way to implement buttons and lists`,
                    `To understand more about how it works, I recommend you check the following URLs`,
                    `https://builderbot.vercel.app/en/providers/twilio/uses-cases`,
                ],
            })
        })
    })

    describe('#sendMedia ', () => {
        test('should send media via Twilio and emit a notice for local media', async () => {
            // Arrange
            const number = '123456789'
            const message = 'Test message'
            const mediaInput = 'http://localhost:3000/mockMediaUrl'
            const mockCreate = jest.fn().mockImplementation(() => undefined)
            const mockTwilio = {
                twilio: { messages: { create: mockCreate } },
            }
            twilioProvider.vendor = mockTwilio as any
            ;(utils.encryptData as jest.MockedFunction<typeof utils.encryptData>).mockImplementation(
                (data) => `mockEncrypted${data}`
            )

            // Act
            const result = await twilioProvider.sendMedia(number, message, mediaInput)

            // Assert
            expect(result).toEqual(undefined)
            expect(utils.encryptData).toHaveBeenCalledWith(encodeURIComponent(mediaInput))
            expect(twilioProvider.emit).toHaveBeenCalledWith('notice', {
                title: '🟠  WARNING 🟠',
                instructions: expect.arrayContaining([
                    expect.stringContaining('You are trying to send a file that is local.'),
                    expect.stringContaining('For this to work with Twilio, the file needs to be in a public URL.'),
                    expect.stringContaining('https://builderbot.vercel.app/en/twilio/uses-cases'),
                    expect.stringContaining('This is the URL that will be sent to Twilio (must be public)'),
                ]),
            })
        })

        test('should send media via Twilio and emit a notice for local media 127.0.0.1', async () => {
            // Arrange
            const number = '123456789'
            const message = 'Test message'
            const mediaInput = 'http://127.0.0.1:3000/mockMediaUrl'
            const mockCreate = jest.fn().mockImplementation(() => undefined)
            const mockTwilio = {
                twilio: { messages: { create: mockCreate } },
            }
            twilioProvider.vendor = mockTwilio as any
            ;(utils.encryptData as jest.MockedFunction<typeof utils.encryptData>).mockImplementation(
                (data) => `mockEncrypted${data}`
            )

            // Act
            const result = await twilioProvider.sendMedia(number, message, mediaInput)

            // Assert
            expect(result).toEqual(undefined)
            expect(utils.encryptData).toHaveBeenCalledWith(encodeURIComponent(mediaInput))
            expect(twilioProvider.emit).toHaveBeenCalledWith('notice', {
                title: '🟠  WARNING 🟠',
                instructions: expect.arrayContaining([
                    expect.stringContaining('You are trying to send a file that is local.'),
                    expect.stringContaining('For this to work with Twilio, the file needs to be in a public URL.'),
                    expect.stringContaining('https://builderbot.vercel.app/en/twilio/uses-cases'),
                    expect.stringContaining('This is the URL that will be sent to Twilio (must be public)'),
                ]),
            })
        })

        test('should send media via Twilio and emit a notice for local media 0.0.0.0', async () => {
            // Arrange
            const number = '123456789'
            const message = 'Test message'
            const mediaInput = 'http://0.0.0.0:3000/mockMediaUrl'
            const mockCreate = jest.fn().mockImplementation(() => undefined)
            const mockTwilio = {
                twilio: { messages: { create: mockCreate } },
            }
            twilioProvider.vendor = mockTwilio as any
            ;(utils.encryptData as jest.MockedFunction<typeof utils.encryptData>).mockImplementation(
                (data) => `mockEncrypted${data}`
            )

            // Act
            const result = await twilioProvider.sendMedia(number, message, mediaInput)

            // Assert
            expect(result).toEqual(undefined)
            expect(utils.encryptData).toHaveBeenCalledWith(encodeURIComponent(mediaInput))
            expect(twilioProvider.emit).toHaveBeenCalledWith('notice', {
                title: '🟠  WARNING 🟠',
                instructions: expect.arrayContaining([
                    expect.stringContaining('You are trying to send a file that is local.'),
                    expect.stringContaining('For this to work with Twilio, the file needs to be in a public URL.'),
                    expect.stringContaining('https://builderbot.vercel.app/en/twilio/uses-cases'),
                    expect.stringContaining('This is the URL that will be sent to Twilio (must be public)'),
                ]),
            })
        })

        test('should throw an error if mediaInput is null', async () => {
            // Arrange
            const number = '123456789'
            const message = 'Test message'
            const mediaInput: any = null

            // Act & Assert
            await expect(twilioProvider.sendMedia(number, message, mediaInput)).rejects.toThrowError(
                'Media cannot be null'
            )
        })
    })

    describe('#busEvents', () => {
        test('#auth_failure - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                message: 'Test',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            twilioProvider['busEvents']()[0].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth_failure', payload)
        })

        test('#ready - should emit the correct events with payloads', async () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            twilioProvider['busEvents']()[1].func({} as any)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ready', true)
        })

        test('#message - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                body: 'Hellow Word!!',
                from: '123456789',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            twilioProvider['busEvents']()[2].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('message', payload)
        })

        test('#host - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                message: 'Test',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            twilioProvider['busEvents']()[3].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('host', payload)
        })
    })

    describe('#beforeHttpServerInit', () => {
        test('beforeHttpServerInit - you should configure middleware to handle HTTP requests', () => {
            // Arrange
            const mockUse = jest.fn().mockReturnThis()
            const mockGet = jest.fn().mockReturnThis()
            const mockPost = jest.fn().mockReturnThis()

            const mockPolka = jest.fn(() => ({
                use: mockUse,
                get: mockGet,
                post: mockPost,
            }))
            const mockIndexHome = jest.fn()
            const mockTwilio = {
                indexHome: mockIndexHome,
            }
            twilioProvider.vendor = mockTwilio as any

            twilioProvider.server = mockPolka() as any
            // Act
            twilioProvider['beforeHttpServerInit']()

            // Assert
            expect(mockUse).toHaveBeenCalled()
            const middleware = mockUse.mock.calls[0][0] as any
            expect(middleware).toBeInstanceOf(Function)
            middleware(mockReq, mockRes, mockNext)
            expect(mockReq.globalVendorArgs).toBe(twilioProvider.globalVendorArgs)
        })
    })

    describe('#initVendor', () => {
        test('should initialize vendor correctly', async () => {
            // Act
            await twilioProvider['initVendor']()

            // Assert
            expect(twilioProvider.vendor).toBeInstanceOf(TwilioCoreVendor)
        })
    })
})
