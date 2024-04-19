import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals'
import { utils } from '@builderbot/bot'
import fs from 'fs'
import mime from 'mime-types'
import { TwilioCoreVendor } from '../src/twilio/core'
import { ITwilioProviderARgs, TwilioPayload, TwilioRequestBody } from '../src/types'

jest.mock('twilio', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue({
        messages: {
            create: jest.fn(),
        },
    }),
}))

jest.mock('@builderbot/bot')
jest.mock('../src/utils', () => ({
    parseNumber: jest.fn().mockImplementation(() => '+123456789'),
}))

describe('#TwilioCoreVendor', () => {
    let twilioCoreVendor: TwilioCoreVendor
    let mockRequest: any
    let mockResponse: any
    let mockNext: any

    afterEach(() => {
        jest.clearAllMocks()
    })

    beforeEach(() => {
        const mockTwilioArgs: ITwilioProviderARgs = {
            accountSid: 'mockAccountSid',
            authToken: 'mockAuthToken',
            vendorNumber: 'mockVendorNumber',
        }
        twilioCoreVendor = new TwilioCoreVendor(mockTwilioArgs)
        mockRequest = {
            body: {
                From: 'mockFromNumber',
                To: 'mockToNumber',
                Body: 'Hello word!',
                NumMedia: '0',
            } as TwilioRequestBody,
        }
        mockResponse = {
            end: jest.fn(),
            writeHead: jest.fn(),
        }
        mockNext = jest.fn()
    })

    describe('#constructor', () => {
        test('should initialize twilio property', () => {
            expect(twilioCoreVendor.twilio).toBeDefined()
        })
    })

    describe('#indexHome', () => {
        test('should respond with "running ok"', () => {
            // Arrange
            const mockResponse = {
                end: jest.fn(),
            }
            // Act
            twilioCoreVendor.indexHome(null as any, mockResponse as any, mockNext)

            // Assert
            expect(mockResponse.end).toHaveBeenCalledWith('running ok')
        })
    })

    describe('incomingMsg', () => {
        test('should handle incoming message correctly', () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            twilioCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            twilioCoreVendor.incomingMsg(mockRequest, mockResponse, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', {
                ...mockRequest.body,
                from: '+123456789',
                to: '+123456789',
                host: '+123456789',
                body: 'Hello word!',
                name: 'undefined',
            } as TwilioPayload)

            expect(mockResponse.end).toHaveBeenCalledWith(expect.any(String))
        })

        test('should handle audio media type', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    NumMedia: '1',
                    MediaContentType0: 'audio/mpeg',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            const refProvider = '_event_voice_note_test'
            twilioCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )

            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', {
                ...mockRequest.body,
                from: '+123456789',
                to: '+123456789',
                host: '+123456789',
                body: refProvider,
                name: 'undefined',
            } as TwilioPayload)
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_voice_note_')
            expect(mockResponse.end).toHaveBeenCalledWith(expect.any(String))
        })

        test('should handle image  media type', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    NumMedia: '1',
                    MediaContentType0: 'image/jpeg',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            const refProvider = '_event_media__test'
            twilioCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )

            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', {
                ...mockRequest.body,
                from: '+123456789',
                to: '+123456789',
                host: '+123456789',
                body: refProvider,
                name: 'undefined',
            } as TwilioPayload)
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_media_')
            expect(mockResponse.end).toHaveBeenCalledWith(expect.any(String))
        })

        test('should handle application  media type', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    NumMedia: '1',
                    MediaContentType0: 'application/pdf',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            const refProvider = '_event_document_test'
            twilioCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )

            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', {
                ...mockRequest.body,
                from: '+123456789',
                to: '+123456789',
                host: '+123456789',
                body: refProvider,
                name: 'undefined',
            } as TwilioPayload)
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_document_')
            expect(mockResponse.end).toHaveBeenCalledWith(expect.any(String))
        })

        test('should handle application  text type', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    NumMedia: '1',
                    MediaContentType0: 'text/text',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            const refProvider = '_event_contacts_test'
            twilioCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            ;(utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>).mockImplementation(
                () => refProvider
            )

            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message', {
                ...mockRequest.body,
                from: '+123456789',
                to: '+123456789',
                host: '+123456789',
                body: refProvider,
                name: 'undefined',
            } as TwilioPayload)
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_contacts_')
            expect(mockResponse.end).toHaveBeenCalledWith(expect.any(String))
        })

        test('should handle default case', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    NumMedia: '1',
                    MediaContentType0: 'other/other',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }
            utils.generateRefProvider as jest.MockedFunction<typeof utils.generateRefProvider>
            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(utils.generateRefProvider).not.toHaveBeenCalled()
        })

        test('should handle location media type when no media but has location coordinates', () => {
            // Arrange
            const mockRequest = {
                body: {
                    From: 'mockFromNumber',
                    To: 'mockToNumber',
                    Body: 'mockMessageBody',
                    Latitude: '123', // Simular coordenadas de ubicación
                    Longitude: '456',
                } as TwilioRequestBody,
            }
            const mockResponse = {
                end: jest.fn(),
            }

            // Act
            twilioCoreVendor.incomingMsg(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(utils.generateRefProvider).toHaveBeenCalledWith('_event_location_')
        })
    })

    describe('#handlerLocalMedia', () => {
        test('should stream the file with correct Content-Type if the file exists', () => {
            // Arrange
            const validFilePath = 'valid/file/path'
            const mockRequest: any = {
                query: {},
            }
            mockRequest.query.path = validFilePath
            const mockMimeType = 'image/jpeg'
            const mockFileStream = { pipe: jest.fn() } as any

            const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
            const createReadStreamSpy = jest.spyOn(fs, 'createReadStream').mockReturnValue(mockFileStream)
            jest.spyOn(mime, 'lookup').mockReturnValue(mockMimeType)

            // Act
            twilioCoreVendor.handlerLocalMedia(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(existsSyncSpy).toHaveBeenCalled()
            expect(createReadStreamSpy).toHaveBeenCalled()
            expect(mime.lookup).toHaveBeenCalled()
            expect(mockResponse.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': mockMimeType })
            expect(mockFileStream.pipe).toHaveBeenCalledWith(mockResponse)
        })

        test('should respond with "path: invalid" if no file path is provided in the query', () => {
            // Act
            twilioCoreVendor.handlerLocalMedia(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(mockResponse.end).toHaveBeenCalledWith('path: invalid')
        })

        test('should respond with "not exists: {file path}" if the file does not exist', () => {
            // Arrange
            const validFilePath = 'valid/file/path'
            const mockRequest: any = {
                query: {},
            }
            mockRequest.query.path = validFilePath
            const mockMimeType = 'image/jpeg'
            const mockFileStream = { pipe: jest.fn() } as any

            const existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
            const createReadStreamSpy = jest.spyOn(fs, 'createReadStream').mockReturnValue(mockFileStream)
            jest.spyOn(mime, 'lookup').mockReturnValue(mockMimeType)

            // Act
            twilioCoreVendor.handlerLocalMedia(mockRequest as any, mockResponse as any, mockNext)

            // Assert
            expect(existsSyncSpy).toHaveBeenCalled()
            expect(createReadStreamSpy).not.toHaveBeenCalled()
            expect(mime.lookup).not.toHaveBeenCalled()
            expect(mockResponse.end).toHaveBeenCalledWith('not exits: undefined')
        })
    })
})
