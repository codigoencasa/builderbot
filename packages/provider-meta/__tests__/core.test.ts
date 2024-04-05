import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import Queue from 'queue-promise'
import { MetaCoreVendor } from '../src/meta/core'
import { Message } from '../src/types'

jest.mock('../src/utils/processIncomingMsg', () => ({
    processIncomingMessage: jest.fn(),
}))

describe('#MetaCoreVendor ', () => {
    let metaCoreVendor: MetaCoreVendor
    let mockNext: any
    beforeEach(() => {
        jest.mock('queue-promise', () => ({
            Queue: jest.fn(() => ({
                enqueue: jest.fn(),
            })),
        }))

        const queue = new Queue()
        metaCoreVendor = new MetaCoreVendor(queue)
        mockNext = jest.fn()
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('#tokenIsValid ', () => {
        test('should return true for valid token', () => {
            // Arrange
            const mode = 'subscribe'
            const token = 'validToken'
            const originToken = 'validToken'

            // Act
            const isValid = metaCoreVendor.tokenIsValid(mode, token, originToken)

            // Assert
            expect(isValid).toBe(true)
        })

        test('should return false for invalid token', () => {
            // Arrange
            const mode = 'subscribe'
            const token = 'validToken'
            const originToken = 'invalidToken'

            // Act
            const isValid = metaCoreVendor.tokenIsValid(mode, token, originToken)

            // Assert
            expect(isValid).toBe(false)
        })
    })

    describe('#verifyToken ', () => {
        test('should respond with 200 and challenge for valid token', () => {
            // Arrange
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'validToken',
                    'hub.challenge': 'challenge123',
                },
                globalVendorArgs: {
                    verifyToken: 'valid_token',
                },
            }
            const res = {
                end: jest.fn(),
                statusCode: null,
            }
            const tokenIsValidSpy = jest.spyOn(metaCoreVendor, 'tokenIsValid').mockReturnValue(true)

            // Act
            metaCoreVendor.verifyToken(req as any, res as any, mockNext)

            // Assert
            expect(res.statusCode).toBe(200)
            expect(res.end).toHaveBeenCalledWith('challenge123')
            expect(tokenIsValidSpy).toHaveBeenCalled()
        })

        test('should respond with 200 and challenge for valid token', () => {
            // Arrange
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'validToken',
                    'hub.challenge': 'challenge123',
                },
            }
            const res = {
                end: jest.fn(),
                statusCode: null,
            }
            const tokenIsValidSpy = jest.spyOn(metaCoreVendor, 'tokenIsValid').mockReturnValue(true)

            // Act
            metaCoreVendor.verifyToken(req as any, res as any, mockNext)

            // Assert
            expect(res.statusCode).toBe(200)
            expect(res.end).toHaveBeenCalledWith('challenge123')
            expect(tokenIsValidSpy).toHaveBeenCalled()
        })

        test('should respond with 403 and appropriate message if mode or token is missing', () => {
            // Arrange
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                },
                globalVendorArgs: {
                    verifyToken: 'valid_token',
                },
            }
            const res = {
                end: jest.fn(),
                statusCode: null,
            }

            // Act
            metaCoreVendor.verifyToken(req as any, res as any, mockNext)

            // Assert
            expect(res.statusCode).toBe(403)
            expect(res.end).toHaveBeenCalledWith('No token!')
        })

        test('should respond with 403 and appropriate message if token is invalid', async () => {
            // Arrange
            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'invalid_token',
                    'hub.challenge': 'test_challenge',
                },
                globalVendorArgs: {
                    verifyToken: 'valid_token',
                },
            }
            const res = {
                end: jest.fn(),
                statusCode: null,
            }

            // Act
            await metaCoreVendor.verifyToken(req as any, res as any, mockNext)

            // Assert
            expect(res.statusCode).toBe(403)
            expect(res.end).toHaveBeenCalledWith('Invalid token!')
        })
    })

    describe('#indexHome', () => {
        test('should respond with "running ok"', () => {
            // Arrange
            const mockResponse = {
                end: jest.fn(),
            }
            // Act
            metaCoreVendor.indexHome(null as any, mockResponse as any, mockNext)

            // Assert
            expect(mockResponse.end).toHaveBeenCalledWith('running ok')
        })
    })

    describe('#extractStatus', () => {
        test('should extract status array correctly', () => {
            // Arrange
            const mockObj = {
                entry: [
                    {
                        changes: [
                            {
                                value: {
                                    statuses: [
                                        {
                                            recipient_id: 'recipient_1',
                                            errors: [
                                                {
                                                    error_data: {
                                                        details: 'error_1_details',
                                                    },
                                                },
                                            ],
                                            status: 'failed',
                                        },
                                        {
                                            recipient_id: 'recipient_2',
                                            errors: [
                                                {
                                                    error_data: {
                                                        details: 'error_2_details',
                                                    },
                                                },
                                            ],
                                            status: 'success',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            // Act
            const statusArray = metaCoreVendor['extractStatus'](mockObj)

            // Assert
            expect(statusArray).toEqual([
                {
                    status: 'failed',
                    reason: 'Number(recipient_1): error_1_details',
                },
                {
                    status: 'success',
                    reason: 'Number(recipient_2): error_2_details',
                },
            ])
        })

        test('should handle empty entry object', () => {
            // Arrange
            const mockObj = { entry: [] }

            // Act
            const statusArray = metaCoreVendor['extractStatus'](mockObj)

            // Assert
            expect(statusArray).toEqual([])
        })
    })

    describe('#processMessage', () => {
        test('should emit a "message" event and resolve the promise', async () => {
            // Arrange
            const mockMessage: Message = {
                type: '',
                from: '',
                to: '',
                body: '',
                pushName: '',
                name: '',
            }

            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            const promise = metaCoreVendor.processMessage(mockMessage)

            // Assert
            await expect(promise).resolves.toBeUndefined()
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('message', mockMessage)
        })

        test('should reject the promise if an error occurs during event emission', async () => {
            // Arrange
            const mockMessage: Message = {
                type: '',
                from: '',
                to: '',
                body: '',
                pushName: '',
                name: '',
            }

            const mockEmitError = jest.fn(() => {
                throw new Error('Test error')
            })
            const mockEventEmitterError = {
                emit: mockEmitError,
            }
            metaCoreVendor.emit = (mockEventEmitterError as any).emit.bind(mockEventEmitterError)

            // Act
            const promise = metaCoreVendor.processMessage(mockMessage)

            // Assert
            await expect(promise).rejects.toThrowError('Test error')
        })
    })

    describe('#incomingMsg', () => {
        test('should handle failed status and respond with errors', async () => {
            // Arrange
            const mockReq = {
                body: {},
                globalVendorArgs: {},
            }
            const mockRes = {
                writeHead: jest.fn(),
                end: jest.fn(),
            }
            const mockStatus = [{ status: 'failed', reason: 'Error reason' }]
            jest.spyOn(metaCoreVendor, 'extractStatus' as any).mockReturnValue(mockStatus)
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaCoreVendor.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: ['Error reason'],
            })
            expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
            expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify(mockStatus))
        })

        test('should respond with "empty endpoint" if there are no messages', async () => {
            // Arrange
            const mockReq = {
                body: { entry: [{ changes: [{ value: { messages: [] } }] }] },
                globalVendorArgs: {},
            }
            const mockRes = {
                statusCode: 0,
                end: jest.fn(),
            }

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('empty endpoint')
        })

        test('should handle processing messages and respond with success', async () => {
            // Arrange
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [{ value: { messages: [{}], contacts: [{}] } }],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = {
                statusCode: 0,
                end: jest.fn(),
            }
            ;(require('../src/utils/processIncomingMsg').processIncomingMessage as jest.Mock).mockImplementation(
                () => true
            )

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('Messages enqueued')
        })
    })
})
