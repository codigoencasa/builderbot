import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { WebWhatsappProvider } from '../src/index'
import { Client } from 'whatsapp-web.js'
import { utils } from '@builderbot/bot'
import mime from 'mime-types'
import fs from 'fs'
import path from 'path'
import { writeFile } from 'fs/promises'

const phoneNumber = '1234567890@c.us'

jest.mock('@builderbot/bot')

jest.mock('../src/utils', () => ({
    wwebCleanNumber: jest.fn().mockImplementation(() => phoneNumber),
    wwebIsValidNumber: jest.fn().mockImplementation(() => false),
    wwebGenerateImage: jest.fn(),
    wwebGetChromeExecutablePath: jest.fn(),
    wwebDeleteTokens: jest.fn(),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

describe('#WebWhatsappProvider', () => {
    let webWhatsappProvider: WebWhatsappProvider
    let mockNext: any
    let mockRes: any
    let mockReq: any
    beforeEach(() => {
        const args = { name: 'bot', gifPlayback: false }
        webWhatsappProvider = new WebWhatsappProvider(args)
        mockNext = jest.fn()
        mockReq = {}
        mockRes = {
            writeHead: jest.fn(),
            end: jest.fn(),
            pipe: jest.fn(),
        }
    })

    describe('#initVendor', () => {
        test('initVendor initializes the vendor correctly', async () => {
            // Arrange

            // Act
            const result = await webWhatsappProvider['initVendor']()

            // Assert
            expect(result).toBeInstanceOf(Client)
        })
    })

    describe('#sendMessage', () => {
        test('Send text message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, world!'
            const options = {}
            const mockSendText = jest.fn().mockImplementation(() => 'Text message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendText,
            } as any
            jest.spyOn(webWhatsappProvider, 'sendButtons')
            jest.spyOn(webWhatsappProvider, 'sendMedia')
            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, options)

            // Assert
            expect(mockSendText).toHaveBeenCalledWith('1234567890@c.us', fakeMessage)
            expect(webWhatsappProvider.sendButtons).not.toHaveBeenCalled()
            expect(webWhatsappProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send message with buttons', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Choose an option:'
            const fakeButtons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const fakeOptions = { buttons: fakeButtons }
            jest.spyOn(webWhatsappProvider, 'sendButtons').mockImplementation(() => true as any)
            jest.spyOn(webWhatsappProvider, 'sendMedia')

            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(webWhatsappProvider.sendButtons).toHaveBeenCalledWith('1234567890@c.us', fakeMessage, fakeButtons)
            expect(webWhatsappProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send media message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Here is a media file'
            const fakeMedia = 'path/to/media.jpg'
            const fakeOptions = { media: fakeMedia }
            jest.spyOn(webWhatsappProvider, 'sendButtons')
            jest.spyOn(webWhatsappProvider, 'sendMedia').mockImplementation(() => true as any)

            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(webWhatsappProvider.sendMedia).toHaveBeenCalledWith('1234567890@c.us', fakeMedia, fakeMessage)
            expect(webWhatsappProvider.sendButtons).not.toHaveBeenCalled()
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
            const sendImageSpy = jest
                .spyOn(webWhatsappProvider, 'sendImage')
                .mockImplementation(async () => true as any)

            // Act
            await webWhatsappProvider.sendMedia(number, imageUrl, text)

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
            const sendVideoSpy = jest
                .spyOn(webWhatsappProvider, 'sendVideo')
                .mockImplementation(async () => true as any)

            // Act
            await webWhatsappProvider.sendMedia(number, videoUrl, text)

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
            const sendAudioSpy = jest
                .spyOn(webWhatsappProvider, 'sendAudio')
                .mockImplementation(async () => undefined as any)
            // Act
            await webWhatsappProvider.sendMedia(number, audioUrl, text)

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
            const sendFileSpy = jest
                .spyOn(webWhatsappProvider, 'sendFile')
                .mockImplementation(async () => undefined as any)
            // Act
            await webWhatsappProvider.sendMedia(number, fileUrl, text)
            // Assert
            expect(sendFileSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(fileUrl)
        })
    })

    describe('#sendFile', () => {
        test('should send a file successfully', async () => {
            // Arrange:
            const number = '+1234567890'
            const filePath = '/path/to/test/file.txt'
            const text = 'Test file'
            jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('sticker-buffer'))
            jest.spyOn(mime, 'lookup').mockReturnValue('text/plain')
            const mockSendFile = jest.fn().mockImplementation(() => 'file message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendFile,
            } as any
            // Act
            const result = await webWhatsappProvider.sendFile(number, filePath, text)

            // Assert
            expect(result).toBeTruthy()
            expect(mockSendFile).toHaveBeenCalled()
        })
    })

    describe('#sendVideo', () => {
        test('should send a sendVideo  successfully', async () => {
            // Arrange:
            const number = '+1234567890'
            const filePath = '/path/to/test/file.txt'
            const text = 'Test file'
            jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('sticker-buffer'))
            jest.spyOn(mime, 'lookup').mockReturnValue('video/mp3')
            const mockSendVideo = jest.fn().mockImplementation(() => 'video message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendVideo,
            } as any
            // Act
            const result = await webWhatsappProvider.sendVideo(number, filePath, text)

            // Assert
            expect(result).toBeTruthy()
            expect(mockSendVideo).toHaveBeenCalled()
        })
    })

    describe('#sendAudio', () => {
        test('should send a sendAudio  successfully', async () => {
            // Arrange:
            const number = '+1234567890'
            const filePath = '/path/to/test/file.txt'
            const text = 'Test file'
            jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('sticker-buffer'))
            jest.spyOn(mime, 'lookup').mockReturnValue('audio/mp3')
            const mockSendAudio = jest.fn().mockImplementation(() => 'audio message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendAudio,
            } as any
            // Act
            const result = await webWhatsappProvider.sendAudio(number, filePath, text)

            // Assert
            expect(result).toBeTruthy()
            expect(mockSendAudio).toHaveBeenCalled()
        })
    })

    describe('#sendImage', () => {
        test('should send a sendImage  successfully', async () => {
            // Arrange:
            const number = '+1234567890'
            const filePath = '/path/to/test/file.txt'
            const text = 'Test file'
            jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('sticker-buffer'))
            jest.spyOn(mime, 'lookup').mockReturnValue('imagen/png')
            const mockSendImage = jest.fn().mockImplementation(() => 'imagen message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendImage,
            } as any
            // Act
            const result = await webWhatsappProvider.sendImage(number, filePath, text)

            // Assert
            expect(result).toBeTruthy()
            expect(mockSendImage).toHaveBeenCalled()
        })
    })

    describe('#sendButtons', () => {
        test('Send buttons successfully', async () => {
            // Arrange
            webWhatsappProvider.emit = jest.fn()
            const number = '+123456789'
            const message = 'Message with buttons'
            const buttons = [{ body: 'Button 1' }, { body: 'Button 2' }]
            const mockSendButtons = jest.fn().mockImplementation(() => 'Buttons sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendButtons,
            } as any
            // Act
            const result = await webWhatsappProvider.sendButtons(number, message, buttons)

            // Assert
            expect(result).toEqual('Buttons sent')
            expect(webWhatsappProvider.emit).toHaveBeenCalledWith('notice', {
                title: 'DEPRECATED',
                instructions: [
                    `Currently sending buttons is not available with this provider`,
                    `this function is available with Meta or Twilio`,
                ],
            })

            expect(mockSendButtons).toHaveBeenCalled()
        })
    })

    describe('#busEvents', () => {
        test('Should return undefine if the from status@broadcast', async () => {
            // Arrange
            const message: any = {
                from: 'status@broadcast',
            }
            // Act
            const resul = await webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(resul).toEqual(undefined)
        })

        test('Should return undefine if the from status@broadcast', async () => {
            // Arrange
            const message: any = {
                from: phoneNumber,
            }
            ;(require('../src/utils').wwebIsValidNumber as jest.Mock).mockImplementation(() => false)
            // Act
            const resul = await webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(resul).toBeUndefined()
        })

        test('messaga emit event media', () => {
            // Arrange
            const message: any = {
                _data: {
                    type: 'image',
                    from: '1234567890',
                },
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_media__test'
            ;(require('../src/utils').wwebIsValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
        })

        test('Set body property for document type', () => {
            // Arrange
            const message: any = {
                _data: {
                    type: 'document',
                    from: phoneNumber,
                },
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_document_test'
            ;(require('../src/utils').wwebIsValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_document_')
        })

        test('Set body property for ptt type', () => {
            // Arrange
            const message: any = {
                _data: {
                    type: 'ptt',
                    from: phoneNumber,
                },
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_voice_note_test'
            ;(require('../src/utils').wwebIsValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_voice_note_')
        })

        test('Set body property for lat and  lng type', () => {
            // Arrange
            const message: any = {
                _data: {
                    lat: '1224',
                    lng: '1224',
                    from: phoneNumber,
                },
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            const refProvider = '_event_location_test'
            ;(require('../src/utils').wwebIsValidNumber as jest.Mock).mockImplementation(() => true)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )
            // Act
            webWhatsappProvider['busEvents']()[3].func(message)

            // Assert
            expect(mockEmit).toHaveBeenCalled()
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_location_')
        })

        test('#auth_failure - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                message: 'Test',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            webWhatsappProvider['busEvents']()[0].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth_failure', payload)
        })

        test('#ready - should emit the correct events with payloads', async () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            webWhatsappProvider['busEvents']()[2].func({} as any)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ready', true)
        })
        test('#qr - should emit the correct events with payloads', async () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            webWhatsappProvider['busEvents']()[1].func('qr')
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('require_action', {
                instructions: [
                    'You must scan the QR Code',
                    'Remember that the QR code updates every minute',
                    'Need help: https://link.codigoencasa.com/DISCORD',
                ],
                title: '⚡⚡ ACTION REQUIRED ⚡⚡',
            })
        })
    })

    describe('#saveFile', () => {
        test('Save file successfully', async () => {
            // Arrange
            const ctx = { fileData: { mimetype: 'image/png', data: 'base64encodeddata' } }
            const options = { path: '/tmp' }
            const expectedFilePath = '/tmp/some-file-name.png'

            jest.spyOn(path, 'join').mockImplementation(() => expectedFilePath)
            // Act
            const result = await webWhatsappProvider.saveFile(ctx as any, options)

            // Assert
            expect(result).toContain('some-file-name.png')
            expect(writeFile).toHaveBeenCalled()
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
            webWhatsappProvider['indexHome'](req as any, res as any, mockNext)
            // Assert
            expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' })
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

            webWhatsappProvider.server = mockPolka() as any
            // Act
            webWhatsappProvider['beforeHttpServerInit']()

            // Assert
            expect(mockUse).toHaveBeenCalled()
            const middleware = mockUse.mock.calls[0][0] as any
            expect(middleware).toBeInstanceOf(Function)
            middleware(mockReq, mockRes, mockNext)
            expect(mockReq.globalVendorArgs).toBe(webWhatsappProvider.globalVendorArgs)
            expect(mockGet).toHaveBeenCalledWith('/', webWhatsappProvider.indexHome)
        })
    })

    describe('#afterHttpServerInit ', () => {
        test(' emits a notice event with the correct data', () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            webWhatsappProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            // Act
            webWhatsappProvider['afterHttpServerInit']()

            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('notice', {
                title: '⏱️  Loading... ',
                instructions: [`this process can take up to 90 seconds`, `we will let you know shortly`],
            })
        })
    })
})
