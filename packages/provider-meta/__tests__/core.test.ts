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
            const result = metaCoreVendor['extractStatus'](mockObj)

            // Assert
            expect(result.all).toEqual([
                {
                    status: 'failed',
                    reason: 'Number(recipient_1): error_1_details',
                },
                {
                    status: 'success',
                    reason: 'Number(recipient_2): error_2_details',
                },
            ])
            expect(result.firstFailed).toEqual({
                status: 'failed',
                reason: 'Number(recipient_1): error_1_details',
            })
        })

        test('should handle empty entry object', () => {
            // Arrange
            const mockObj = { entry: [] }

            // Act
            const result = metaCoreVendor['extractStatus'](mockObj)

            // Assert
            expect(result).toEqual({ all: [], firstFailed: undefined })
        })

        test('should fall back to recipient_user_id when recipient_id is absent', () => {
            // Arrange — for users with a hidden phone (username adopted), Meta sends recipient_user_id only
            const mockObj = {
                entry: [
                    {
                        changes: [
                            {
                                value: {
                                    statuses: [
                                        {
                                            recipient_user_id: 'US.13491208655302741918',
                                            errors: [{ error_data: { details: 'reach_failed' } }],
                                            status: 'failed',
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                ],
            }

            // Act
            const result = metaCoreVendor['extractStatus'](mockObj)

            // Assert
            const failed = {
                status: 'failed',
                reason: 'Number(US.13491208655302741918): reach_failed',
            }
            expect(result.all).toEqual([failed])
            expect(result.firstFailed).toEqual(failed)
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
            await expect(promise).rejects.toThrow('Test error')
        })
    })

    describe('#incomingMsg — webhook signature (appSecret)', () => {
        test('does not validate signature when appSecret is not configured (default, backward-compatible)', async () => {
            // Arrange
            const mockReq = {
                body: { entry: [{ changes: [{ value: { messages: [] } }] }] },
                headers: {},
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('empty endpoint')
        })

        test('rejects with 401 when appSecret is configured and the signature header is missing', async () => {
            // Arrange
            const mockReq = {
                body: { entry: [{ changes: [{ value: { messages: [] } }] }] },
                headers: {},
                globalVendorArgs: { appSecret: 'test-app-secret' },
            }
            const mockRes = { statusCode: 0, end: jest.fn() }
            const mockEmit = jest.fn()
            metaCoreVendor.emit = mockEmit as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(401)
            expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid webhook signature' }))
            expect(mockEmit).toHaveBeenCalledWith(
                'notice',
                expect.objectContaining({ title: expect.stringContaining('WEBHOOK') })
            )
        })

        test('rejects with 401 when appSecret is configured and the signature is invalid', async () => {
            // Arrange
            const mockReq = {
                body: { entry: [{ changes: [{ value: { messages: [] } }] }] },
                headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
                globalVendorArgs: { appSecret: 'test-app-secret' },
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(401)
        })

        test('accepts the request and processes it normally when the signature is valid', async () => {
            // Arrange
            const { createHmac } = require('node:crypto')
            const body = { entry: [{ changes: [{ value: { messages: [] } }] }] }
            const rawBody = JSON.stringify(body)
            const signature = `sha256=${createHmac('sha256', 'test-app-secret').update(rawBody).digest('hex')}`
            const mockReq = {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': signature },
                globalVendorArgs: { appSecret: 'test-app-secret' },
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('empty endpoint')
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
            jest.spyOn(metaCoreVendor, 'extractStatus' as any).mockReturnValue({
                all: mockStatus,
                firstFailed: mockStatus[0],
            })
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

        test('should forward contact.user_id (BSUID) to processIncomingMessage', async () => {
            // Arrange
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    value: {
                                        messages: [{ type: 'text', from: 'sender', text: { body: 'Hi' } }],
                                        contacts: [
                                            {
                                                profile: { name: 'Jane' },
                                                wa_id: '5491123456789',
                                                user_id: 'US.13491208655302741918',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = {
                statusCode: 0,
                end: jest.fn(),
            }
            const processSpy = require('../src/utils/processIncomingMsg').processIncomingMessage as jest.Mock
            processSpy.mockImplementation(() => true)

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'US.13491208655302741918' }))
        })

        test('does not call callVendor when it is not set (default flows unaffected)', async () => {
            // Arrange — no callVendor passed to the constructor
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'calls',
                                    value: { calls: [{ id: 'call-1', event: 'connect' }] },
                                },
                            ],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act & Assert — must not throw even without a callVendor
            await expect(metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)).resolves.not.toThrow()
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should dispatch a "connect" call event to callVendor.onConnect', async () => {
            // Arrange
            const onConnect = jest.fn().mockImplementation(() => Promise.resolve())
            const onTerminate = jest.fn()
            const callVendor: any = { onConnect, onTerminate }
            const vendorWithCalls = new MetaCoreVendor(new Queue(), callVendor)

            const callEvent = { id: 'call-abc', from: '15559999999', event: 'connect' }
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [{ field: 'calls', value: { calls: [callEvent] } }],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await vendorWithCalls.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(onConnect).toHaveBeenCalledWith(callEvent)
            expect(onTerminate).not.toHaveBeenCalled()
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('should dispatch a "terminate" call event to callVendor.onTerminate', async () => {
            // Arrange
            const onConnect = jest.fn()
            const onTerminate = jest.fn()
            const callVendor: any = { onConnect, onTerminate }
            const vendorWithCalls = new MetaCoreVendor(new Queue(), callVendor)

            const callEvent = { id: 'call-xyz', event: 'terminate' }
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [{ field: 'calls', value: { calls: [callEvent] } }],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await vendorWithCalls.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(onTerminate).toHaveBeenCalledWith('call-xyz')
            expect(onConnect).not.toHaveBeenCalled()
        })

        test('should not treat a "messages" field as a calls webhook (no regression)', async () => {
            // Arrange
            const onConnect = jest.fn()
            const onTerminate = jest.fn()
            const callVendor: any = { onConnect, onTerminate }
            const vendorWithCalls = new MetaCoreVendor(new Queue(), callVendor)

            const mockReq = {
                body: { entry: [{ changes: [{ field: 'messages', value: { messages: [] } }] }] },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await vendorWithCalls.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert — falls through to the regular "empty endpoint" messages path
            expect(onConnect).not.toHaveBeenCalled()
            expect(onTerminate).not.toHaveBeenCalled()
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('empty endpoint')
        })

        test('should handle contact without wa_id (username-only user)', async () => {
            // Arrange — for a user with a username and no phone number, Meta may omit wa_id
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    value: {
                                        messages: [{ type: 'text', from: 'sender', text: { body: 'Hi' } }],
                                        contacts: [
                                            {
                                                profile: { name: 'Jane' },
                                                user_id: 'US.13491208655302741918',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = {
                statusCode: 0,
                end: jest.fn(),
            }
            const processSpy = require('../src/utils/processIncomingMsg').processIncomingMessage as jest.Mock
            processSpy.mockImplementation(() => true)

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert — must still forward userId even when wa_id is absent
            expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({ userId: 'US.13491208655302741918' }))
        })
    })
})
