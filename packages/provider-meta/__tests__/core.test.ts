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

    describe('#normalizeStatuses', () => {
        test('should normalize status array preserving id, timestamp and errors', () => {
            // Arrange
            const failedStatus = {
                id: 'wamid.failed',
                recipient_id: 'recipient_1',
                timestamp: '1700000001',
                errors: [{ error_data: { details: 'error_1_details' } }],
                status: 'failed',
            }
            const sentStatus = { id: 'wamid.sent', recipient_id: 'recipient_2', status: 'sent' }
            const mockObj = {
                entry: [{ changes: [{ value: { statuses: [failedStatus, sentStatus] } }] }],
            }

            // Act
            const result = metaCoreVendor['normalizeStatuses'](mockObj)

            // Assert
            expect(result.events).toEqual([
                {
                    id: 'wamid.failed',
                    recipientId: 'recipient_1',
                    recipientUserId: null,
                    status: 'failed',
                    timestamp: '1700000001',
                    errors: [{ error_data: { details: 'error_1_details' } }],
                    raw: failedStatus,
                },
                {
                    id: 'wamid.sent',
                    recipientId: 'recipient_2',
                    recipientUserId: null,
                    status: 'sent',
                    timestamp: null,
                    errors: [],
                    raw: sentStatus,
                },
            ])
            expect(result.firstFailed).toEqual(result.events[0])
        })

        test('should handle empty entry object', () => {
            // Arrange
            const mockObj = { entry: [] }

            // Act
            const result = metaCoreVendor['normalizeStatuses'](mockObj)

            // Assert
            expect(result).toEqual({ events: [], firstFailed: undefined })
        })

        test('should fall back to recipient_user_id when recipient_id is absent', () => {
            // Arrange — for users with a hidden phone (username adopted), Meta sends recipient_user_id only
            const status = {
                id: 'wamid.bsuid',
                recipient_user_id: 'US.13491208655302741918',
                errors: [{ error_data: { details: 'reach_failed' } }],
                status: 'failed',
            }
            const mockObj = { entry: [{ changes: [{ value: { statuses: [status] } }] }] }

            // Act
            const result = metaCoreVendor['normalizeStatuses'](mockObj)

            // Assert
            expect(result.events).toEqual([
                {
                    id: 'wamid.bsuid',
                    recipientId: 'US.13491208655302741918',
                    recipientUserId: 'US.13491208655302741918',
                    status: 'failed',
                    timestamp: null,
                    errors: [{ error_data: { details: 'reach_failed' } }],
                    raw: status,
                },
            ])
            expect(result.firstFailed).toEqual(result.events[0])
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
        test('emits message_status + notice and responds 200 by default for failed statuses', async () => {
            // Arrange
            const status = {
                id: 'wamid.abc',
                recipient_id: '123',
                status: 'failed',
                timestamp: '1700000000',
                errors: [{ error_data: { details: 'reach_failed' } }],
            }
            const mockReq = {
                body: { entry: [{ changes: [{ value: { statuses: [status] } }] }] },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, writeHead: jest.fn(), end: jest.fn() }
            const mockEmit = jest.fn()
            metaCoreVendor.emit = mockEmit as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith('message_status', {
                id: 'wamid.abc',
                recipientId: '123',
                recipientUserId: null,
                status: 'failed',
                timestamp: '1700000000',
                errors: [{ error_data: { details: 'reach_failed' } }],
                raw: status,
            })
            expect(mockEmit).toHaveBeenCalledWith('notice', {
                title: '🔔  META ALERT  🔔',
                instructions: ['Number(123): reach_failed'],
            })
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
            expect(mockRes.writeHead).not.toHaveBeenCalled()
        })

        test('responds 400 with the legacy body when statusWebhookRespondOnFailure is legacy-400', async () => {
            // Arrange
            const status = {
                id: 'wamid.legacy',
                recipient_id: '999',
                status: 'failed',
                errors: [{ error_data: { details: 'x' } }],
            }
            const mockReq = {
                body: { entry: [{ changes: [{ value: { statuses: [status] } }] }] },
                globalVendorArgs: { statusWebhookRespondOnFailure: 'legacy-400' },
            }
            const mockRes = { statusCode: 0, writeHead: jest.fn(), end: jest.fn() }
            metaCoreVendor.emit = jest.fn() as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockRes.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' })
            expect(mockRes.end).toHaveBeenCalledWith(JSON.stringify([{ status: 'failed', reason: 'Number(999): x' }]))
        })

        test('emits message_status for sent/delivered/read and responds 200 without notice', async () => {
            // Arrange
            const statuses = [
                { id: 'w1', recipient_id: '1', status: 'sent', timestamp: '1' },
                { id: 'w2', recipient_id: '1', status: 'delivered', timestamp: '2' },
                { id: 'w3', recipient_id: '1', status: 'read', timestamp: '3' },
            ]
            const mockReq = { body: { entry: [{ changes: [{ value: { statuses } }] }] }, globalVendorArgs: {} }
            const mockRes = { statusCode: 0, writeHead: jest.fn(), end: jest.fn() }
            const mockEmit = jest.fn()
            metaCoreVendor.emit = mockEmit as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledTimes(3)
            expect(mockEmit).toHaveBeenCalledWith(
                'message_status',
                expect.objectContaining({ id: 'w1', status: 'sent' })
            )
            expect(mockEmit).toHaveBeenCalledWith(
                'message_status',
                expect.objectContaining({ id: 'w2', status: 'delivered' })
            )
            expect(mockEmit).toHaveBeenCalledWith(
                'message_status',
                expect.objectContaining({ id: 'w3', status: 'read' })
            )
            expect(mockEmit).not.toHaveBeenCalledWith('notice', expect.anything())
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('OK')
        })

        test('preserves BSUID recipient and unknown statuses', async () => {
            // Arrange
            const status = { id: 'wz', recipient_user_id: 'US.999', status: 'some_new_status', timestamp: '5' }
            const mockReq = {
                body: { entry: [{ changes: [{ value: { statuses: [status] } }] }] },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, writeHead: jest.fn(), end: jest.fn() }
            const mockEmit = jest.fn()
            metaCoreVendor.emit = mockEmit as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledWith(
                'message_status',
                expect.objectContaining({
                    id: 'wz',
                    recipientId: 'US.999',
                    recipientUserId: 'US.999',
                    status: 'some_new_status',
                    timestamp: '5',
                })
            )
            expect(mockRes.statusCode).toBe(200)
        })

        test('emits statuses across multiple entries and changes', async () => {
            // Arrange
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                { value: { statuses: [{ id: 'a', status: 'sent' }] } },
                                { value: { statuses: [{ id: 'b', status: 'delivered' }] } },
                            ],
                        },
                        { changes: [{ value: { statuses: [{ id: 'c', status: 'read' }] } }] },
                    ],
                },
                globalVendorArgs: {},
            }
            const mockRes = { statusCode: 0, writeHead: jest.fn(), end: jest.fn() }
            const mockEmit = jest.fn()
            metaCoreVendor.emit = mockEmit as any

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(mockEmit).toHaveBeenCalledTimes(3)
            expect(mockRes.statusCode).toBe(200)
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

        test('should emit call_status for business-initiated call statuses', async () => {
            // Arrange
            const callVendor: any = { onConnect: jest.fn(), onTerminate: jest.fn() }
            const vendorWithCalls = new MetaCoreVendor(new Queue(), callVendor)

            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    field: 'calls',
                                    value: {
                                        calls: [],
                                        statuses: [
                                            {
                                                id: 'wacid.1',
                                                type: 'call',
                                                status: 'RINGING',
                                                timestamp: '1762216151',
                                                recipient_id: '15559999999',
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
            const mockRes = { statusCode: 0, end: jest.fn() }

            const events: unknown[] = []
            vendorWithCalls.on('call_status', (e) => events.push(e))

            // Act
            await vendorWithCalls.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert
            expect(events).toEqual([
                { callId: 'wacid.1', status: 'RINGING', timestamp: '1762216151', recipientId: '15559999999' },
            ])
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

        test('Jose Santos fixture: username-only webhook resolves from to BSUID', async () => {
            const { processIncomingMessage: realProcess } = jest.requireActual(
                '../src/utils/processIncomingMsg'
            ) as typeof import('../src/utils/processIncomingMsg')
            const processSpy = require('../src/utils/processIncomingMsg').processIncomingMessage as jest.Mock
            let resolvedMessage: Message | undefined
            processSpy.mockImplementation(async (params: any) => {
                resolvedMessage = await realProcess(params)
                return resolvedMessage
            })

            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    value: {
                                        metadata: {
                                            display_phone_number: '573133324152',
                                            phone_number_id: '123',
                                        },
                                        messages: [
                                            {
                                                type: 'text',
                                                from_user_id: 'CO.2177313826172406',
                                                id: 'wamid.HBgTQ08uMjE3NzMxMzgyNjE3MjQwNhUUABIYIEFDQ0FFRDUxNzg0NERENjFBNTY1MEI0MTNCMkQ0MTY5AA==',
                                                timestamp: '1785827662',
                                                text: { body: 'ping' },
                                            },
                                        ],
                                        contacts: [
                                            {
                                                profile: { name: 'Jose Santos', username: 'josesantos' },
                                                user_id: 'CO.2177313826172406',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
                globalVendorArgs: { jwtToken: 'token', numberId: '123', version: 'v18.0' },
            }
            const mockRes = {
                statusCode: 0,
                end: jest.fn(),
            }

            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            expect(processSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'CO.2177313826172406',
                    username: 'josesantos',
                })
            )
            expect(resolvedMessage).toEqual(
                expect.objectContaining({
                    from: 'CO.2177313826172406',
                    userId: 'CO.2177313826172406',
                    username: 'josesantos',
                    body: 'ping',
                    to: '573133324152',
                })
            )
            expect(mockRes.statusCode).toBe(200)
            expect(mockRes.end).toHaveBeenCalledWith('Messages enqueued')
        })

        test('falls back to profile.username when profile.name is absent', async () => {
            // Arrange — username-only contacts may not send profile.name
            const processSpy = require('../src/utils/processIncomingMsg').processIncomingMessage as jest.Mock
            processSpy.mockImplementation(() => true)
            const mockReq = {
                body: {
                    entry: [
                        {
                            changes: [
                                {
                                    value: {
                                        messages: [
                                            {
                                                type: 'text',
                                                from_user_id: 'US.13491208655302741918',
                                                id: 'wamid.NONAME',
                                                timestamp: '1785827662',
                                                text: { body: 'hi' },
                                            },
                                        ],
                                        contacts: [
                                            {
                                                profile: { username: 'josesantos' },
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
            const mockRes = { statusCode: 0, end: jest.fn() }

            // Act
            await metaCoreVendor.incomingMsg(mockReq as any, mockRes as any, mockNext)

            // Assert — flows get the username as display name instead of 'Unknown'
            expect(processSpy).toHaveBeenCalledWith(expect.objectContaining({ pushName: 'josesantos' }))
        })
    })
})
