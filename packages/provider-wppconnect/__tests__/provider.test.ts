import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import path from 'path'
import mime from 'mime-types'
import { writeFile } from 'fs/promises'
import { utils } from '@builderbot/bot'
import wppconnect from '@wppconnect-team/wppconnect'
import { WPPConnectProvider } from '../src'

const phoneNumber = '1234567890'

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

jest.mock('../src/utils', () => ({
    WppConnectValidNumber: jest.fn().mockImplementation(() => true),
    WppConnectCleanNumber: jest.fn(),
    WppConnectGenerateImage: jest.fn(),
    WppDeleteTokens: jest.fn(),
}))

jest.mock('@wppconnect-team/wppconnect', () => ({
    create: jest.fn(),
    defaultLogger: { transports: [{ silent: true }] },
}))

jest.mock('@builderbot/bot')

describe('#WPPConnectProvider', () => {
    let wPPConnectProvider: WPPConnectProvider
    let mockNext: any
    let mockRes: any
    let mockReq: any

    beforeEach(() => {
        wPPConnectProvider = new WPPConnectProvider({ name: 'test-bot' })
        mockNext = jest.fn()
        mockReq = {}
        mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            pipe: jest.fn(),
        }
    })

    describe('#saveFile', () => {
        test('Save file successfully', async () => {
            // Arrange
            const mockedDecryptFile = jest.fn().mockImplementation(() => Buffer.from('fileContent'))
            const ctx = { mimetype: 'image/png' }
            const options = { path: '/tmp' }
            const expectedFilePath = '/tmp/some-file-name.png'

            wPPConnectProvider.vendor = {
                decryptFile: mockedDecryptFile,
            } as any
            jest.spyOn(path, 'join').mockImplementation(() => expectedFilePath)
            // Act
            const result = await wPPConnectProvider.saveFile(ctx, options)

            // Assert
            expect(result).toContain('some-file-name.png')
            expect(mockedDecryptFile).toHaveBeenCalledWith(ctx)
            expect(writeFile).toHaveBeenCalledWith(expectedFilePath, Buffer.from('fileContent'))
            mockedDecryptFile.mockReset()
        })
    })

    describe('#sendMessage', () => {
        test('Send text message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, world!'
            const options = {}
            const mockSendText = jest.fn().mockImplementation(() => 'Text message sent')
            wPPConnectProvider.vendor = {
                sendText: mockSendText,
            } as any
            jest.spyOn(wPPConnectProvider, 'sendButtons')
            jest.spyOn(wPPConnectProvider, 'sendMedia')
            // Act
            await wPPConnectProvider.sendMessage(fakeRecipient, fakeMessage, options)

            // Assert
            expect(mockSendText).toHaveBeenCalledWith(fakeRecipient, fakeMessage)
            expect(wPPConnectProvider.sendButtons).not.toHaveBeenCalled()
            expect(wPPConnectProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send message with buttons', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Choose an option:'
            const fakeButtons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const fakeOptions = { buttons: fakeButtons }
            jest.spyOn(wPPConnectProvider, 'sendButtons').mockImplementation(() => true as any)
            jest.spyOn(wPPConnectProvider, 'sendMedia')

            // Act
            await wPPConnectProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(wPPConnectProvider.sendButtons).toHaveBeenCalledWith(fakeRecipient, fakeMessage, fakeButtons)
            expect(wPPConnectProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send media message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Here is a media file'
            const fakeMedia = 'path/to/media.jpg'
            const fakeOptions = { media: fakeMedia }
            jest.spyOn(wPPConnectProvider, 'sendButtons')
            jest.spyOn(wPPConnectProvider, 'sendMedia').mockResolvedValue(() => true)

            // Act
            await wPPConnectProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(wPPConnectProvider.sendMedia).toHaveBeenCalledWith(fakeRecipient, fakeMedia, fakeMessage)
            expect(wPPConnectProvider.sendButtons).not.toHaveBeenCalled()
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
            const sendImageSpy = jest.spyOn(wPPConnectProvider, 'sendImage').mockImplementation(async () => true as any)

            // Act
            await wPPConnectProvider.sendMedia(number, imageUrl, text)

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
            const sendVideoSpy = jest.spyOn(wPPConnectProvider, 'sendVideo').mockImplementation(async () => true as any)

            // Act
            await wPPConnectProvider.sendMedia(number, videoUrl, text)

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
            const sendAudioSpy = jest.spyOn(wPPConnectProvider, 'sendPtt').mockImplementation(async () => undefined)
            // Act
            await wPPConnectProvider.sendMedia(number, audioUrl, text)

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
            const sendFileSpy = jest.spyOn(wPPConnectProvider, 'sendFile').mockImplementation(async () => undefined)
            // Act
            await wPPConnectProvider.sendMedia(number, fileUrl, text)

            // Assert
            expect(sendFileSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(fileUrl)
        })
    })

    describe('#sendVideo', () => {
        test('Send video as GIF', async () => {
            // Arrange
            wPPConnectProvider.vendor = {
                sendVideoAsGif: jest.fn().mockImplementation(() => 'Video sent'),
            } as any
            const number = '+123456789'
            const filePath = '/path/to/video.mp4'
            const text = 'Check out this video'
            // Act
            const result = await wPPConnectProvider.sendVideo(number, filePath, text)

            // Assert
            expect(result).toEqual('Video sent')
            expect(wPPConnectProvider.vendor.sendVideoAsGif).toHaveBeenCalledWith(number, filePath, 'video.gif', text)
        })
    })

    describe('#sendFile', () => {
        test('Send file successfully', async () => {
            // Arrange
            wPPConnectProvider.vendor = {
                sendFile: jest.fn().mockImplementation(() => 'File sent'),
            } as any
            const number = '+123456789'
            const filePath = '/path/to/file.txt'
            const text = 'Check out this file'
            jest.spyOn(path, 'basename').mockImplementation(() => filePath)

            // Act
            const result = await wPPConnectProvider.sendFile(number, filePath, text)

            // Assert
            expect(result).toEqual('File sent')
            expect(wPPConnectProvider.vendor.sendFile).toHaveBeenCalledWith(number, filePath, filePath, text)
        })
    })

    describe('#sendImage', () => {
        test('Send image successfully', async () => {
            // Arrange
            wPPConnectProvider.vendor = {
                sendImage: jest.fn().mockImplementation(() => 'Image sent'),
            } as any
            const number = '+123456789'
            const filePath = '/path/to/image.png'
            const text = 'Check out this image'
            jest.spyOn(path, 'basename').mockImplementation(() => filePath)

            // Act
            const result = await wPPConnectProvider.sendImage(number, filePath, text)

            // Assert
            expect(result).toEqual('Image sent')
            expect(wPPConnectProvider.vendor.sendImage).toHaveBeenCalledWith(number, filePath, 'image-name', text)
        })
    })
    describe('#sendPtt', () => {
        test('should call vendor.sendPtt with correct arguments', async () => {
            // Arrange
            wPPConnectProvider.vendor = {
                sendPtt: jest.fn().mockImplementation(() => 'Image sent'),
            } as any
            const number = '+123456789'
            const filePath = '/path/to/image.png'
            jest.spyOn(path, 'basename').mockImplementation(() => filePath)

            // Act
            const result = await wPPConnectProvider.sendPtt(number, filePath)

            // Assert
            expect(result).toEqual('Image sent')
            expect(wPPConnectProvider.vendor.sendPtt).toHaveBeenCalledWith(number, filePath)
        })
    })

    describe('sendPoll', () => {
        test('should return false if poll options length is less than 2', async () => {
            // Arrange
            wPPConnectProvider.vendor = {
                sendPollMessage: jest.fn().mockImplementation(() => 'Image sent'),
            } as any
            const number = '123456789'
            const text = 'Sample poll text'
            const poll = {
                options: ['Option 1'],
                multiselect: false,
            }

            // Act
            const result = await wPPConnectProvider.sendPoll(number, text, poll)

            // Assert
            expect(result).toBe(false)
            expect(wPPConnectProvider.vendor.sendPollMessage).not.toHaveBeenCalled()
        })

        test('should call vendor.sendPollMessage with correct arguments', async () => {
            // Arrange
            const number = '123456789'
            const text = 'Sample poll text'
            const poll = {
                options: ['Option 1', 'Option 2'],
                multiselect: true,
            }
            wPPConnectProvider.vendor = {
                sendPollMessage: jest.fn().mockImplementation(() => 'sent'),
            } as any

            // Act
            const result = await wPPConnectProvider.sendPoll(number, text, poll)

            // Assert
            expect(result).toEqual('sent')
            expect(wPPConnectProvider.vendor.sendPollMessage).toHaveBeenCalledWith(number, text, poll.options, {
                selectableCount: 1,
            })
        })
    })

    describe('#sendButtons', () => {
        test('should emit notice event with correct details', async () => {
            // Arrange
            const number = '123456789'
            const text = 'Button message'
            const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]

            const mockEmit = jest.fn()
            wPPConnectProvider.emit = mockEmit
            wPPConnectProvider.vendor = {
                sendText: jest.fn().mockImplementation(() => 'sent'),
            } as any
            // Act
            await wPPConnectProvider.sendButtons(number, text, buttons)

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
            const number = '123456789'
            const text = 'Button message'
            const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]

            // Mock del método sendMessage
            wPPConnectProvider.vendor = {
                sendText: jest.fn().mockImplementation(() => 'success'),
            } as any

            // Act
            const result = await wPPConnectProvider.sendButtons(number, text, buttons)

            // Assert
            expect(result).toEqual('success')
            expect(wPPConnectProvider.vendor.sendText).toHaveBeenCalled()
        })
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

            wPPConnectProvider.server = mockPolka() as any
            // Act
            wPPConnectProvider['beforeHttpServerInit']()

            // Assert
            expect(mockUse).toHaveBeenCalled()
            const middleware = mockUse.mock.calls[0][0] as any
            expect(middleware).toBeInstanceOf(Function)
            middleware(mockReq, mockRes, mockNext)
            expect(mockReq.globalVendorArgs).toBe(wPPConnectProvider.globalVendorArgs)
            expect(mockGet).toHaveBeenCalledWith('/', wPPConnectProvider.indexHome)
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
            wPPConnectProvider['indexHome'](req as any, res as any, mockNext)
            // Assert
            expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' })
        })
    })

    describe('#listenOnEvents', () => {
        test('Assign events correctly', () => {
            // Arrange
            const mockVendor = {
                onMessage: jest.fn(),
                onIncomingCall: jest.fn(),
            } as any
            wPPConnectProvider.vendor = mockVendor
            const mockEvents = [{ event: 'onMessage', func: jest.fn() }]
            wPPConnectProvider.busEvents = jest.fn().mockReturnValue(mockEvents) as any

            // Act
            wPPConnectProvider['listenOnEvents'](mockVendor)

            // Assert
            mockEvents.forEach(({ event }) => {
                if (mockVendor[event]) {
                    expect(mockVendor[event]).toHaveBeenCalled()
                    mockVendor[event]({ from: 'sender@example.com', name: 'Sender Name' })
                }
            })
        })

        test('Throw error if vendor is empty', () => {
            // Arrange
            wPPConnectProvider.vendor = null as any

            // Act & Assert
            expect(() => wPPConnectProvider['listenOnEvents'](null as any)).toThrowError(
                'Vendor should not return empty'
            )
        })

        test('Set vendor when not defined', () => {
            // Arrange
            const mockVendor = {
                onMessage: jest.fn(),
            } as any

            // Act
            wPPConnectProvider['listenOnEvents'](mockVendor)

            // Assert
            expect(wPPConnectProvider.vendor).toEqual(mockVendor)
        })
    })

    describe('#busEvents', () => {
        test('Should return undefine if the from status@broadcast', () => {
            // Arrange
            const message: any = {
                from: 'status@broadcast',
            }
            // Act
            const resul = wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('Should return undefine if the from status@broadcast', () => {
            // Arrange
            const message: any = {
                from: phoneNumber,
            }
            ;(require('../src/utils').WppConnectValidNumber as jest.Mock).mockImplementation(() => false)
            // Act
            const resul = wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('Set body property for image or video type', () => {
            // Arrange
            const message: any = {
                type: 'image',
                from: phoneNumber,
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_voice_note_test'
            ;(require('../src/utils').WppConnectValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
        })

        test('Set body property for document type', () => {
            // Arrange
            const message: any = {
                type: 'document',
                from: phoneNumber,
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_document_test'
            ;(require('../src/utils').WppConnectValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_document_')
        })

        test('Set body property for ptt type', () => {
            // Arrange
            const message: any = {
                type: 'ptt',
                from: phoneNumber,
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_voice_note_test'
            ;(require('../src/utils').WppConnectValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_voice_note_')
        })

        test('Set body property for lat and  lng type', () => {
            // Arrange
            const message: any = {
                lat: '1224',
                lng: '1224',
                from: phoneNumber,
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_location_test'
            ;(require('../src/utils').WppConnectValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            wPPConnectProvider['busEvents']()[0].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_location_')
        })

        test('should modify payload correctly and emit "message" event', async () => {
            // Arrange
            const payload: any = {
                selectedOptions: [{ name: 'Option 1' }],
                msgId: { _serialized: '12345' },
                chatId: 'chat123',
                sender: '+123456789',
            }
            const payloadExpected = {
                body: 'Option 1',
                chatId: 'chat123',
                from: undefined,
                id: '12345',
                msgId: { _serialized: '12345' },
                notifyName: 'John Doe',
                selectedOptions: [{ name: 'Option 1' }],
                sender: { pushname: 'John Doe' },
                t: undefined,
                to: '+123456789',
                type: 'poll',
            }

            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            wPPConnectProvider.vendor = {
                getContact: jest.fn().mockImplementation(() => ({ pushname: 'John Doe' })),
            } as any

            // Act
            await wPPConnectProvider['busEvents']()[1].func(payload)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', payloadExpected)
        })
    })

    describe('#initVendor', () => {
        test('should initialize the vendor successfully', async () => {
            // Arrange
            const mockHostDevice = { id: { user: 'mockUserId' }, pushname: 'mockPushName' }
            ;(wppconnect.create as jest.Mock).mockImplementationOnce((_, qrCallback, statusCallback, options) => {
                return Promise.resolve({
                    getWid: async () => mockHostDevice,
                    onIncomingCall: jest.fn(),
                } as any)
            })

            // Act
            await wPPConnectProvider['initVendor']()

            // Assert
            expect(wppconnect.create).toHaveBeenCalled()
            expect(wPPConnectProvider.vendor).toBeDefined()
        })
    })

    describe('#afterHttpServerInit ', () => {
        test(' emits a notice event with the correct data', () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            wPPConnectProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            // Act
            wPPConnectProvider['afterHttpServerInit']()

            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('notice', {
                title: '⏱️  Loading... ',
                instructions: [`this process can take up to 90 seconds`, `we will let you know shortly`],
            })
        })
    })
})
