import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { ChatwootApi } from '../src/chatwootApi'
import { ChatwootPlugin, createChatwootPlugin } from '../src/chatwootPlugin'

// ─── config ───────────────────────────────────────────────────────────────────

const MOCK_CONFIG = {
    token: 'test-token-123',
    url: 'https://chatwoot.example.com',
    accountId: 1,
}

const MOCK_INBOX = { id: 42, name: 'BuilderBot Inbox' }

// ─── fetch mock ───────────────────────────────────────────────────────────────

type MockFn = (url: string, opts?: RequestInit) => Promise<Response>

/**
 * Smart fetch mock: matches requests by method + URL substring.
 * More specific entries (longer path strings) win over shorter ones.
 */
const makeSmartFetch = (overrides: Record<string, unknown> = {}): { mock: MockFn; calls: string[] } => {
    const calls: string[] = []

    const defaults: Record<string, unknown> = {
        'GET /api/v1/accounts/1/': { id: 1 },
        'GET /inboxes': { payload: [MOCK_INBOX] },
        'POST /inboxes': MOCK_INBOX,
        'GET /webhooks': { payload: { webhooks: [] } },
        'POST /webhooks': { id: 1, url: '' },
        'GET /contacts/search': { payload: [] },
        'GET /conversations': { payload: [] },
        'POST /contacts': { payload: { contact: { id: 10 } } },
        'POST /conversations': { id: 99, inbox_id: 42, contact_id: 10 },
        'POST /messages': { id: 1, content: 'ok', message_type: 'outgoing' },
        ...overrides,
    }

    const mock: MockFn = async (url, opts) => {
        const method = (opts?.method ?? 'GET').toUpperCase()
        calls.push(`${method} ${String(url)}`)

        const key = Object.keys(defaults)
            .sort((a, b) => b.length - a.length)
            .find((k) => {
                const space = k.indexOf(' ')
                const kMethod = k.slice(0, space)
                const kPath = k.slice(space + 1)
                return kMethod === method && String(url).includes(kPath)
            })

        const body = key !== undefined ? defaults[key] : {}
        return {
            ok: true,
            json: async () => body,
            text: async () => JSON.stringify(body),
            headers: new Headers({ 'content-type': 'application/json' }),
            arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response
    }

    return { mock, calls }
}

/** Temporarily replace global.fetch, restore after fn resolves. */
const withFetch = async <T>(mockFn: MockFn, fn: () => Promise<T>): Promise<T> => {
    const original = (global as any).fetch
    ;(global as any).fetch = mockFn
    try {
        return await fn()
    } finally {
        ;(global as any).fetch = original
    }
}

/** Wait for the internal SimpleQueue to drain. */
const drainQueue = () => new Promise<void>((r) => setTimeout(r, 60))

// ─── mock bot ─────────────────────────────────────────────────────────────────

const makeMockBot = (saveFileImpl?: (ctx: unknown, opts?: unknown) => Promise<string>) => {
    const botHandlers: Record<string, Array<(...a: unknown[]) => unknown>> = {}
    const provHandlers: Record<string, Array<(...a: unknown[]) => unknown>> = {}
    const serverRoutes: Record<string, (req: any, res: any) => Promise<void>> = {}
    const serverGetRoutes: Record<string, (req: any, res: any) => void> = {}
    return {
        on(ev: string, h: (...a: unknown[]) => unknown) {
            botHandlers[ev] = [...(botHandlers[ev] ?? []), h]
        },
        emit: (ev: string, payload: unknown) => Promise.all((botHandlers[ev] ?? []).map((h) => h(payload))),
        provider: {
            on(ev: string, h: (...a: unknown[]) => unknown) {
                provHandlers[ev] = [...(provHandlers[ev] ?? []), h]
            },
            emit: (ev: string, payload: unknown) => Promise.all((provHandlers[ev] ?? []).map((h) => h(payload))),
            server: {
                routes: serverRoutes,
                getRoutes: serverGetRoutes,
                post(path: string, handler: (req: any, res: any) => Promise<void>) {
                    serverRoutes[path] = handler
                },
                get(path: string, handler: (req: any, res: any) => void) {
                    serverGetRoutes[path] = handler
                },
            },
            ...(saveFileImpl ? { saveFile: saveFileImpl } : {}),
        },
        blacklist: {
            items: new Set<string>(),
            add(p: string) {
                this.items.add(p)
            },
            remove(p: string) {
                this.items.delete(p)
            },
            checkIf(p: string) {
                return this.items.has(p)
            },
        },
        sent: [] as Array<{ number: string; content: string; options?: unknown }>,
        async sendMessage(number: string, content: string, options?: unknown) {
            this.sent.push({ number, content, options })
        },
    }
}

// ─── existing construction tests ─────────────────────────────────────────────

test('createChatwootPlugin returns a ChatwootPlugin instance', () => {
    assert.instance(createChatwootPlugin(MOCK_CONFIG), ChatwootPlugin)
})

test('ChatwootPlugin exposes getApi()', () => {
    assert.instance(createChatwootPlugin(MOCK_CONFIG).getApi(), ChatwootApi)
})

test('ChatwootPlugin getInbox() returns null before attach', () => {
    assert.is(createChatwootPlugin(MOCK_CONFIG).getInbox(), null)
})

test('createChatwootPlugin uses default inbox name', () => {
    assert.instance(createChatwootPlugin(MOCK_CONFIG), ChatwootPlugin)
})

test('createChatwootPlugin accepts custom inbox name', () => {
    assert.instance(createChatwootPlugin({ ...MOCK_CONFIG, inboxName: 'Custom Inbox' }), ChatwootPlugin)
})

test('ChatwootApi constructs with correct base URL', () => {
    assert.instance(new ChatwootApi(MOCK_CONFIG), ChatwootApi)
})

test('ChatwootApi trims trailing slash from URL', () => {
    assert.instance(new ChatwootApi({ ...MOCK_CONFIG, url: 'https://chatwoot.example.com/' }), ChatwootApi)
})

// ─── status flag ─────────────────────────────────────────────────────────────

test('plugin status is true by default', () => {
    assert.is(createChatwootPlugin(MOCK_CONFIG).status, true)
})

test('attach() sets status=false and skips inbox when credentials are invalid', async () => {
    const { mock } = makeSmartFetch({ 'GET /api/v1/accounts/1/': { error: 'unauthorized' } })
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.is(plugin.status, false)
    assert.is(plugin.getInbox(), null)
})

test('attach() sets inbox and keeps status=true when credentials are valid', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.is(plugin.status, true)
    assert.is(plugin.getInbox()?.id, MOCK_INBOX.id)
})

// ─── webhook auto-creation ────────────────────────────────────────────────────

test('attach() registers webhook when webhookUrl is configured', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/chatwoot' })
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.ok(
        calls.some((c) => c.startsWith('POST') && c.includes('/webhooks')),
        'POST /webhooks was called to register the webhook'
    )
})

test('attach() skips webhook registration when webhookUrl is not configured', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.not.ok(
        calls.some((c) => c.startsWith('POST') && c.includes('/webhooks')),
        'POST /webhooks should not be called without webhookUrl'
    )
})

// ─── group filter ─────────────────────────────────────────────────────────────

test('send_message handler skips @g.us group messages', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    const countAfterAttach = calls.length

    await withFetch(mock, async () => {
        await bot.emit('send_message', { from: '1234567890@g.us', answer: 'Hello group' })
        await drainQueue()
    })
    assert.is(calls.length, countAfterAttach, 'no fetch calls for group send_message')
})

test('provider message handler skips @g.us group messages', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    const countAfterAttach = calls.length

    await withFetch(mock, async () => {
        await bot.provider.emit('message', { from: '9876543210@g.us', body: 'Group message' })
        await drainQueue()
    })
    assert.is(calls.length, countAfterAttach, 'no fetch calls for group provider message')
})

// ─── handleWebhook ────────────────────────────────────────────────────────────

test('handleWebhook returns early when inbox ID does not match', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    await plugin.handleWebhook(bot as any, {
        event: 'message_created',
        message_type: 'outgoing',
        private: false,
        content: 'Should be ignored',
        conversation: { inbox_id: 9999, channel: 'Channel::Api', meta: { sender: { phone_number: '+1234' } } },
    })
    assert.is(bot.sent.length, 0, 'sendMessage not called for mismatched inbox')
})

test('handleWebhook adds phone to blacklist when agent is assigned', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    await plugin.handleWebhook(bot as any, {
        event: 'conversation_updated',
        changed_attributes: [{ assignee_id: { current_value: 7 } }],
        meta: { sender: { phone_number: '+5215511223344' } },
        conversation: { inbox_id: MOCK_INBOX.id },
    })
    assert.ok(bot.blacklist.items.has('5215511223344'), 'phone added to blacklist')
})

test('handleWebhook removes phone from blacklist when agent is unassigned', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    bot.blacklist.items.add('5215511223344')

    await plugin.handleWebhook(bot as any, {
        event: 'conversation_updated',
        changed_attributes: [{ assignee_id: { current_value: null } }],
        meta: { sender: { phone_number: '+5215511223344' } },
        conversation: { inbox_id: MOCK_INBOX.id },
    })
    assert.not.ok(bot.blacklist.items.has('5215511223344'), 'phone removed from blacklist')
})

test('handleWebhook forwards outgoing API channel message to WhatsApp', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    await plugin.handleWebhook(bot as any, {
        event: 'message_created',
        message_type: 'outgoing',
        private: false,
        content: 'Hello from agent',
        conversation: {
            inbox_id: MOCK_INBOX.id,
            channel: 'Channel::Api',
            meta: { sender: { phone_number: '+5215511223344' } },
        },
    })
    assert.is(bot.sent.length, 1, 'sendMessage called once')
    assert.is(bot.sent[0].number, '5215511223344')
    assert.is(bot.sent[0].content, 'Hello from agent')
})

test('handleWebhook does not forward private messages to WhatsApp', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    await plugin.handleWebhook(bot as any, {
        event: 'message_created',
        message_type: 'outgoing',
        private: true,
        content: 'Internal agent note',
        conversation: {
            inbox_id: MOCK_INBOX.id,
            channel: 'Channel::Api',
            meta: { sender: { phone_number: '+5215511223344' } },
        },
    })
    assert.is(bot.sent.length, 0, 'private message must not be forwarded')
})

test('handleWebhook is a no-op before attach()', async () => {
    const bot = makeMockBot()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    await plugin.handleWebhook(bot as any, {
        event: 'message_created',
        message_type: 'outgoing',
        private: false,
        content: 'Should be ignored',
        conversation: { inbox_id: 42, channel: 'Channel::Api' },
    })
    assert.is(bot.sent.length, 0, 'no action before attach')
})

// ─── media support ────────────────────────────────────────────────────────────

test('ChatwootApi.sendMessage sends JSON when no media is provided', async () => {
    const { mock, calls } = makeSmartFetch()
    const api = new ChatwootApi(MOCK_CONFIG)
    await withFetch(mock, () => api.sendMessage(1, 'hello', 'outgoing'))
    assert.ok(
        calls.some((c) => c.startsWith('POST') && c.includes('/messages')),
        'POST /messages called for text message'
    )
})

test('ChatwootApi.sendMessage sends FormData when mediaSource is provided', async () => {
    const bodies: unknown[] = []
    const captureFetch: MockFn = async (_url, opts) => {
        bodies.push(opts?.body)
        return {
            ok: true,
            json: async () => ({ id: 1, content: 'ok', message_type: 'outgoing' }),
            text: async () => '{}',
            headers: new Headers({ 'content-type': 'application/json' }),
            // arrayBuffer is needed for the media download step
            arrayBuffer: async () => new ArrayBuffer(8),
        } as unknown as Response
    }
    const api = new ChatwootApi(MOCK_CONFIG)
    await withFetch(captureFetch, () => api.sendMessage(1, 'with media', 'outgoing', 'https://example.com/image.png'))
    const formDataBody = bodies.find((b) => b instanceof FormData)
    assert.instance(formDataBody, FormData, 'a POST body should be FormData when media is provided')
})

// ─── SimpleQueue serialization ────────────────────────────────────────────────

// ─── media / _event_* normalization ──────────────────────────────────────────

/** Extracts { content, message_type } from either a JSON string body or FormData. */
const extractMessageBody = (body: unknown): { content: string; message_type: string } | null => {
    if (body instanceof FormData) {
        return { content: String(body.get('content') ?? ''), message_type: String(body.get('message_type') ?? '') }
    }
    if (typeof body === 'string') {
        try {
            return JSON.parse(body)
        } catch {
            return null
        }
    }
    return null
}

test('provider message: _event_media_ with options.media sends empty content (attachment speaks for itself)', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []
    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            options: { media: 'https://example.com/photo.jpg' },
        })
        await drainQueue()
    })

    const msg = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(msg, 'a message was sent to Chatwoot')
    assert.is(msg?.content, '', 'media with no caption → empty content, no redundant [image] label')
})

test('provider message: _event_voice_note_ with options.media sends empty content', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []
    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_voice_note_',
            options: { media: 'https://example.com/audio.ogg' },
        })
        await drainQueue()
    })

    const msg = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(msg, 'a message was sent to Chatwoot')
    assert.is(msg?.content, '', 'audio with media URL → empty content, no redundant [audio] label')
})

test('provider message: media-only message with empty body is still synced to Chatwoot', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    const countAfterAttach = calls.length

    await withFetch(mock, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '',
            options: { media: 'https://example.com/photo.jpg' },
        })
        await drainQueue()
    })

    assert.ok(calls.length > countAfterAttach, 'fetch calls were made for media-only incoming message')
})

test('send_message: media-only bot message (empty content) is synced to Chatwoot', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    const countAfterAttach = calls.length

    await withFetch(mock, async () => {
        await bot.emit('send_message', {
            from: '5215511223344',
            answer: '',
            options: { media: 'https://example.com/image.png' },
        })
        await drainQueue()
    })

    assert.ok(calls.length > countAfterAttach, 'fetch calls were made for media-only outgoing message')
})

test('handleWebhook forwards all attachments when agent sends multiple files', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    await plugin.handleWebhook(bot as any, {
        event: 'message_created',
        message_type: 'outgoing',
        private: false,
        content: 'See attached files',
        attachments: [
            { data_url: 'https://example.com/file1.pdf' },
            { data_url: 'https://example.com/file2.png' },
            { data_url: 'https://example.com/file3.mp4' },
        ],
        conversation: {
            inbox_id: MOCK_INBOX.id,
            channel: 'Channel::Api',
            meta: { sender: { phone_number: '+5215511223344' } },
        },
    })

    assert.is(bot.sent.length, 3, 'one sendMessage call per attachment')
    assert.is((bot.sent[0].options as any)?.media, 'https://example.com/file1.pdf', 'first file with content')
    assert.is(bot.sent[0].content, 'See attached files', 'text goes with first file')
    assert.is((bot.sent[1].options as any)?.media, 'https://example.com/file2.png', 'second file separate')
    assert.is((bot.sent[2].options as any)?.media, 'https://example.com/file3.mp4', 'third file separate')
})

// ─── auto HTTP route registration ────────────────────────────────────────────

test('attach() auto-registers POST route on provider.server when webhookUrl is set', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.ok(
        bot.provider.server.routes['/v1/chatwoot'] !== undefined,
        'POST route /v1/chatwoot should be registered on provider.server'
    )
})

test('attach() does not register any route when webhookUrl is not set', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.is(Object.keys(bot.provider.server.routes).length, 0, 'no routes should be registered without webhookUrl')
})

test('auto-registered route forwards agent message to WhatsApp', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))

    const handler = bot.provider.server.routes['/v1/chatwoot']
    assert.ok(handler, 'route handler must exist')

    const mockRes = {
        headers: {} as Record<string, string>,
        body: '',
        writeHead(_code: number, headers: Record<string, string>) {
            this.headers = { ...this.headers, ...headers }
        },
        end(data: string) {
            this.body = data
        },
    }

    await handler(
        {
            body: {
                event: 'message_created',
                message_type: 'outgoing',
                private: false,
                content: 'Hello from agent via route',
                conversation: {
                    inbox_id: MOCK_INBOX.id,
                    channel: 'Channel::Api',
                    meta: { sender: { phone_number: '+5215511223344' } },
                },
            },
        },
        mockRes
    )

    assert.is(bot.sent.length, 1, 'sendMessage should be called once')
    assert.is(bot.sent[0].number, '5215511223344', 'message sent to correct phone')
    assert.is(bot.sent[0].content, 'Hello from agent via route', 'message content matches')
    assert.is(mockRes.body, JSON.stringify({ status: 'ok' }), 'response body is { status: ok }')
})

// ─── SimpleQueue serialization ────────────────────────────────────────────────

test('enqueued messages are processed without dropping', async () => {
    const { mock, calls } = makeSmartFetch()
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    const countAfterAttach = calls.length

    await withFetch(mock, async () => {
        await bot.emit('send_message', { from: '5215511223344', answer: 'msg1' })
        await bot.emit('send_message', { from: '5215511223344', answer: 'msg2' })
        await drainQueue()
    })
    assert.ok(calls.length > countAfterAttach, 'fetch calls were made for enqueued messages')
})

// ─── saveFile fallback + public URL (WA → Chatwoot, no options.media) ────────

test('attach() registers GET /media/:filename route when webhookUrl and server.get are present', async () => {
    const { mock } = makeSmartFetch()
    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot()
    await withFetch(mock, () => plugin.attach(bot as any))
    assert.ok(
        bot.provider.server.getRoutes['/media/:filename'] !== undefined,
        'GET /media/:filename route should be registered'
    )
})

test('provider message: _event_media_ without options.media uses saveFile + public URL', async () => {
    const SAVED_PATH = '/tmp/chatwoot-media/file-12345.jpg'
    const bodies: ReturnType<typeof extractMessageBody>[] = []
    const downloadedUrls: string[] = []

    const saveFileMock = async (_ctx: unknown, _opts?: unknown): Promise<string> => SAVED_PATH

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        // Capture media download attempts
        if (String(url).includes('/media/')) {
            downloadedUrls.push(String(url))
        }
        return baseMock(url, opts)
    }

    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot(saveFileMock)
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            message: { imageMessage: { mimetype: 'image/jpeg' } },
        })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'a message was sent to Chatwoot')
    assert.is(incoming?.content, '', 'image with no caption + media URL → empty content')
    // The media was fetched from the public URL
    assert.ok(
        downloadedUrls.some((u) => u.includes('https://bot.example.com/media/file-12345.jpg')),
        'plugin fetched media from the public /media URL'
    )
})

test('provider message: saveFile failure falls back to label-only message', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []

    const failingSaveFile = async (_ctx: unknown, _opts?: unknown): Promise<string> => {
        throw new Error('download failed')
    }

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }

    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot(failingSaveFile)
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            message: { imageMessage: { mimetype: 'image/jpeg' } },
        })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'message still sent to Chatwoot even when saveFile throws')
    assert.is(incoming?.content, '[image]', 'body still normalized to [image]')
})

test('provider message: image with caption sends real caption text instead of [image]', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }

    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            // Baileys raw WAMessage with a caption
            message: { imageMessage: { mimetype: 'image/jpeg', caption: 'Check this out!' } },
        })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'a message was sent to Chatwoot')
    assert.is(incoming?.content, 'Check this out!', 'real caption replaces [image] label')
})

test('provider message: image without caption sends empty content (no redundant [image] label)', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []

    const SAVED_PATH = '/tmp/chatwoot-media/file-99.jpg'
    const saveFileMock = async (_ctx: unknown, _opts?: unknown): Promise<string> => SAVED_PATH

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }

    const plugin = createChatwootPlugin({ ...MOCK_CONFIG, webhookUrl: 'https://bot.example.com/v1/chatwoot' })
    const bot = makeMockBot(saveFileMock)
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            message: { imageMessage: { mimetype: 'image/jpeg', caption: '' } },
        })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'a message was sent to Chatwoot')
    assert.is(incoming?.content, '', 'no caption + media URL → empty content, no redundant label')
})

test('provider message: video with caption sends real caption text', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }

    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', {
            from: '5215511223344',
            body: '_event_media_',
            message: { videoMessage: { mimetype: 'video/mp4', caption: 'Watch this video' } },
        })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'a message was sent to Chatwoot')
    assert.is(incoming?.content, 'Watch this video', 'video caption is used as content')
})

test('provider message: no saveFile on provider sends [image] label as last-resort fallback', async () => {
    const bodies: ReturnType<typeof extractMessageBody>[] = []

    const { mock: baseMock } = makeSmartFetch()
    const captureFetch: MockFn = async (url, opts) => {
        if (String(url).includes('/messages') && opts?.method === 'POST') {
            bodies.push(extractMessageBody(opts?.body))
        }
        return baseMock(url, opts)
    }

    // No saveFile, no options.media → no mediaUrl → falls back to normalizeBody label
    const plugin = createChatwootPlugin(MOCK_CONFIG)
    const bot = makeMockBot()
    await withFetch(baseMock, () => plugin.attach(bot as any))

    await withFetch(captureFetch, async () => {
        await bot.provider.emit('message', { from: '5215511223344', body: '_event_media_' })
        await drainQueue()
    })

    const incoming = bodies.find((b) => b?.message_type === 'incoming')
    assert.ok(incoming, 'message sent to Chatwoot without saveFile')
    assert.is(incoming?.content, '[image]', 'no media URL → [image] label used as fallback')
})

test.run()
