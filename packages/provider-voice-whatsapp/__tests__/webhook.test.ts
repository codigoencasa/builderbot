import { MetaCallCoreVendor } from '@builderbot/provider-voice'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

// ── Mocks — must be before any imports that trigger the module graph ──────────

jest.mock('@builderbot/bot', () => {
    const { EventEmitter } = require('events')
    class ProviderClass extends EventEmitter {
        server = {
            use: function (this: unknown) {
                return this
            },
            get: function (this: unknown) {
                return this
            },
            post: function (this: unknown) {
                return this
            },
        }
        globalVendorArgs: Record<string, unknown> = {}
    }
    return { ProviderClass }
})

jest.mock('@roamhq/wrtc', () => ({}))

jest.mock('@builderbot/provider-voice', () => ({
    OpenAISTTAdapter: jest.fn(() => ({ transcribe: jest.fn() })),
    OpenAITTSAdapter: jest.fn(() => ({ synthesize: jest.fn(), sampleRate: 24000 })),
    SilenceSegmenter: jest.fn(() => ({ push: jest.fn(), flush: jest.fn() })),
    bufferToInt16: jest.fn(() => new Int16Array(0)),
    chunkPcm: jest.fn(() => []),
    pcmToWav: jest.fn(() => Buffer.alloc(0)),
    MetaCallCoreVendor: jest.fn(),
    CallEvent: { Connect: 'connect', Terminate: 'terminate' },
    CallAction: { PreAccept: 'pre_accept', Accept: 'accept', Reject: 'reject', End: 'end', Call: 'call' },
    CallDirection: { UserInitiated: 'USER_INITIATED', BusinessInitiated: 'BUSINESS_INITIATED' },
    CallState: {
        Idle: 'idle',
        Connecting: 'connecting',
        PreAccepted: 'pre_accepted',
        Accepted: 'accepted',
        Active: 'active',
        Terminated: 'terminated',
    },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import type { WhatsAppCallWebhookPayload } from '../src/types'
import { CallDirection, CallEvent } from '../src/types'
import { WhatsAppVoiceProvider } from '../src/whatsapp-voice/provider'

// ── Types ─────────────────────────────────────────────────────────────────────

type VendorMock = {
    onConnect: jest.Mock<any>

    onTerminate: jest.Mock<any>
}

interface FakeRes {
    status: number
    body: string
    writeHead(s: number): void
    end(b?: string): void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONFIG = {
    jwtToken: 'test-token',
    numberId: '123456789',
    verifyToken: 'my-verify-token',
    version: 'v20.0',
    sttAdapter: { transcribe: jest.fn() },
    ttsAdapter: { synthesize: jest.fn(), sampleRate: 24000 },
}

const makeRes = (): FakeRes => ({
    status: 0,
    body: '',
    writeHead(s: number) {
        this.status = s
    },
    end(b = '') {
        this.body = b
    },
})

const connectPayload = (callId = 'call-001', from = '15551234567'): WhatsAppCallWebhookPayload => ({
    object: 'whatsapp_business_account',
    entry: [
        {
            id: 'WABA',
            changes: [
                {
                    field: 'calls',
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: { display_phone_number: '12345678900', phone_number_id: '999' },
                        calls: [
                            {
                                id: callId,
                                from,
                                to: '12345678900',
                                event: CallEvent.Connect,
                                timestamp: '1762216151',
                                direction: CallDirection.UserInitiated,
                                session: {
                                    sdp: 'v=0\r\na=setup:actpass\r\na=rtpmap:111 opus/48000/2\r\n',
                                    sdp_type: 'offer',
                                },
                            },
                        ],
                    },
                },
            ],
        },
    ],
})

const terminatePayload = (callId = 'call-001'): WhatsAppCallWebhookPayload => ({
    object: 'whatsapp_business_account',
    entry: [
        {
            id: 'WABA',
            changes: [
                {
                    field: 'calls',
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: { display_phone_number: '12345678900', phone_number_id: '999' },
                        calls: [
                            {
                                id: callId,
                                from: '15551234567',
                                to: '12345678900',
                                event: CallEvent.Terminate,
                                timestamp: '1762216200',
                                direction: CallDirection.UserInitiated,
                            },
                        ],
                    },
                },
            ],
        },
    ],
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WhatsAppVoiceProvider webhook handler', () => {
    let provider: WhatsAppVoiceProvider
    let mockVendor: VendorMock
    let handleWebhook: (req: unknown, res: unknown) => void
    let handleVerification: (req: unknown, res: unknown) => void

    beforeEach(() => {
        jest.clearAllMocks()

        mockVendor = {
            onConnect: jest.fn().mockImplementation(() => Promise.resolve()),
            onTerminate: jest.fn(),
        }
        ;(MetaCallCoreVendor as unknown as { mockImplementation: (fn: () => VendorMock) => void }).mockImplementation(
            () => mockVendor
        )

        provider = new WhatsAppVoiceProvider(CONFIG as never)
        ;(provider as unknown as { vendor: VendorMock }).vendor = mockVendor

        handleWebhook = (provider as unknown as { handleWebhook: typeof handleWebhook }).handleWebhook
        handleVerification = (provider as unknown as { handleVerification: typeof handleVerification })
            .handleVerification
    })

    // ── FR-1: Always 200 ─────────────────────────────────────────────────────

    describe('always responds 200 (FR-1)', () => {
        test('responds 200 for a valid connect payload', () => {
            const res = makeRes()
            handleWebhook({ body: connectPayload() }, res)
            expect(res.status).toBe(200)
        })

        test('responds 200 for a valid terminate payload', () => {
            const res = makeRes()
            handleWebhook({ body: terminatePayload() }, res)
            expect(res.status).toBe(200)
        })

        test('responds 200 for an empty payload', () => {
            const res = makeRes()
            handleWebhook({ body: {} }, res)
            expect(res.status).toBe(200)
        })

        test('responds 200 for a non-calls field', () => {
            const res = makeRes()
            handleWebhook(
                {
                    body: {
                        object: 'whatsapp_business_account',
                        entry: [{ id: 'WABA', changes: [{ field: 'messages', value: {} }] }],
                    },
                },
                res
            )
            expect(res.status).toBe(200)
        })
    })

    // ── Dispatch: connect → onConnect ────────────────────────────────────────

    describe('dispatches connect events to vendor.onConnect', () => {
        test('calls vendor.onConnect when field is "calls" and event is "connect"', () => {
            handleWebhook({ body: connectPayload('call-abc', '15559999999') }, makeRes())
            expect(mockVendor.onConnect).toHaveBeenCalledTimes(1)
            const [event] = mockVendor.onConnect.mock.calls[0] as [{ id: string; from: string }]
            expect(event.id).toBe('call-abc')
            expect(event.from).toBe('15559999999')
        })

        test('does NOT call vendor.onTerminate for a connect event', () => {
            handleWebhook({ body: connectPayload() }, makeRes())
            expect(mockVendor.onTerminate).not.toHaveBeenCalled()
        })
    })

    // ── Dispatch: terminate → onTerminate ────────────────────────────────────

    describe('dispatches terminate events to vendor.onTerminate', () => {
        test('calls vendor.onTerminate with the callId when event is "terminate"', () => {
            handleWebhook({ body: terminatePayload('call-xyz') }, makeRes())
            expect(mockVendor.onTerminate).toHaveBeenCalledTimes(1)
            const [callId] = mockVendor.onTerminate.mock.calls[0] as [string]
            expect(callId).toBe('call-xyz')
        })

        test('does NOT call vendor.onConnect for a terminate event', () => {
            handleWebhook({ body: terminatePayload() }, makeRes())
            expect(mockVendor.onConnect).not.toHaveBeenCalled()
        })
    })

    // ── Non-calls field ignored ───────────────────────────────────────────────

    describe('ignores non-calls webhook fields', () => {
        test('does not call onConnect or onTerminate for field "messages"', () => {
            handleWebhook(
                {
                    body: {
                        object: 'whatsapp_business_account',
                        entry: [
                            {
                                id: 'WABA',
                                changes: [{ field: 'messages', value: { calls: [{ event: 'connect' }] } }],
                            },
                        ],
                    },
                },
                makeRes()
            )
            expect(mockVendor.onConnect).not.toHaveBeenCalled()
            expect(mockVendor.onTerminate).not.toHaveBeenCalled()
        })

        test('does not throw when the payload has no changes', () => {
            expect(() => {
                handleWebhook(
                    {
                        body: { object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [] }] },
                    },
                    makeRes()
                )
            }).not.toThrow()
        })

        test('does not throw when entry is empty', () => {
            expect(() => {
                handleWebhook(
                    {
                        body: { object: 'whatsapp_business_account', entry: [] },
                    },
                    makeRes()
                )
            }).not.toThrow()
        })
    })

    // ── GET webhook verification ──────────────────────────────────────────────

    describe('GET /webhook verification handshake', () => {
        test('responds 200 and echoes the challenge when token matches', () => {
            const res = makeRes()
            handleVerification(
                {
                    query: {
                        'hub.mode': 'subscribe',
                        'hub.verify_token': 'my-verify-token',
                        'hub.challenge': 'abc123',
                    },
                },
                res
            )
            expect(res.status).toBe(200)
            expect(res.body).toBe('abc123')
        })

        test('responds 403 when verify_token does not match', () => {
            const res = makeRes()
            handleVerification(
                {
                    query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token', 'hub.challenge': 'abc123' },
                },
                res
            )
            expect(res.status).toBe(403)
        })

        test('responds 403 when hub.mode is not subscribe', () => {
            const res = makeRes()
            handleVerification(
                {
                    query: {
                        'hub.mode': 'unsubscribe',
                        'hub.verify_token': 'my-verify-token',
                        'hub.challenge': 'abc123',
                    },
                },
                res
            )
            expect(res.status).toBe(403)
        })
    })
})
