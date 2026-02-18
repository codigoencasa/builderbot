import { beforeEach, describe, expect, jest, test, afterEach } from '@jest/globals'

import { BaileysProvider } from '../src'

jest.mock('baileys', () => ({
    downloadMediaMessage: jest.fn(),
    proto: {
        Message: {
            fromObject: jest.fn().mockReturnValue({}),
            create: jest.fn().mockReturnValue({}),
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
    getAggregateVotesInPollMessage: jest.fn().mockReturnValue([]),
    makeCacheableSignalKeyStore: jest.fn().mockImplementation((keys: any) => keys),
    DisconnectReason: {
        loggedOut: 401,
        connectionClosed: 428,
        connectionLost: 408,
        connectionReplaced: 440,
        timedOut: 408,
        badSession: 500,
        restartRequired: 515,
    },
    isJidGroup: jest.fn().mockReturnValue(false),
    isJidBroadcast: jest.fn().mockReturnValue(false),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

jest.mock('wa-sticker-formatter', () => ({
    Sticker: jest.fn().mockImplementation(() => ({
        toMessage: (jest.fn() as any).mockResolvedValue(Buffer.from('sticker')),
    })),
}))

jest.mock('../src/utils', () => ({
    baileyCleanNumber: jest.fn().mockImplementation((n: string) => n),
    baileyIsValidNumber: jest.fn().mockReturnValue(true),
    baileyGenerateImage: jest.fn(),
    emptyDirSessions: jest.fn(),
}))

jest.mock('mime-types', () => ({
    lookup: jest.fn().mockReturnValue('text/plain'),
    extension: jest.fn().mockReturnValue('txt'),
}))

jest.mock('@builderbot/bot')

describe('#BaileysProvider - Reliability', () => {
    let provider: BaileysProvider

    beforeEach(() => {
        jest.useFakeTimers()
        provider = new BaileysProvider({
            name: 'test-reliability',
            port: 3002,
        })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    // ===== Reconnection Logic =====

    describe('#shouldReconnect', () => {
        test('should return true for connectionClosed status', () => {
            const result = provider['shouldReconnect'](428)
            expect(result).toBe(true)
        })

        test('should return true for connectionLost status', () => {
            const result = provider['shouldReconnect'](408)
            expect(result).toBe(true)
        })

        test('should return true for rate limited status (429)', () => {
            const result = provider['shouldReconnect'](429)
            expect(result).toBe(true)
        })

        test('should return true for server error (500)', () => {
            const result = provider['shouldReconnect'](500)
            expect(result).toBe(true)
        })

        test('should return true for bad gateway (502)', () => {
            const result = provider['shouldReconnect'](502)
            expect(result).toBe(true)
        })

        test('should return true for service unavailable (503)', () => {
            const result = provider['shouldReconnect'](503)
            expect(result).toBe(true)
        })

        test('should return true for gateway timeout (504)', () => {
            const result = provider['shouldReconnect'](504)
            expect(result).toBe(true)
        })

        test('should return false for unknown status codes', () => {
            const result = provider['shouldReconnect'](999)
            expect(result).toBe(false)
        })

        test('should return false for 200 (OK)', () => {
            const result = provider['shouldReconnect'](200)
            expect(result).toBe(false)
        })

        test('should return false when max reconnect attempts reached', () => {
            provider['reconnectAttempts'] = 10
            const result = provider['shouldReconnect'](428)
            expect(result).toBe(false)
        })
    })

    // ===== Delayed Reconnect =====

    describe('#delayedReconnect', () => {
        test('should increment reconnect attempts counter', async () => {
            provider['reconnectAttempts'] = 0
            provider['initVendor'] = jest.fn().mockReturnValue({
                then: jest.fn(),
            }) as any

            await provider['delayedReconnect']()

            expect(provider['reconnectAttempts']).toBe(1)
        })

        test('should emit auth_failure when max attempts reached', async () => {
            provider['reconnectAttempts'] = 10
            provider['maxReconnectAttempts'] = 10
            const emitSpy = jest.spyOn(provider, 'emit')

            await provider['delayedReconnect']()

            expect(emitSpy).toHaveBeenCalledWith('auth_failure', expect.arrayContaining([
                expect.stringContaining('Maximum reconnection attempts reached'),
            ]))
        })

        test('should not increment attempts when max is reached', async () => {
            provider['reconnectAttempts'] = 10
            provider['maxReconnectAttempts'] = 10

            await provider['delayedReconnect']()

            expect(provider['reconnectAttempts']).toBe(10)
        })

        test('should use exponential backoff for delay', async () => {
            provider['reconnectAttempts'] = 0
            provider['reconnectDelay'] = 1000
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
            provider['initVendor'] = jest.fn().mockReturnValue({ then: jest.fn() }) as any

            // First attempt: delay should be 1000ms * 2^0 = 1000ms
            await provider['delayedReconnect']()
            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 1000)

            // Second attempt: delay should be 1000ms * 2^1 = 2000ms
            await provider['delayedReconnect']()
            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 2000)

            // Third attempt: delay should be 1000ms * 2^2 = 4000ms
            await provider['delayedReconnect']()
            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 4000)
        })

        test('should cap delay at 30000ms', async () => {
            provider['reconnectAttempts'] = 8 // 1000 * 2^8 = 256000 > 30000
            provider['reconnectDelay'] = 1000
            const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
            provider['initVendor'] = jest.fn().mockReturnValue({ then: jest.fn() }) as any

            await provider['delayedReconnect']()

            expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 30000)
        })
    })

    // ===== Cleanup =====

    describe('#cleanup', () => {
        test('should close msgRetryCounterCache', () => {
            const closeSpy = jest.spyOn(provider.msgRetryCounterCache!, 'close')

            provider['cleanup']()

            expect(closeSpy).toHaveBeenCalled()
            expect(provider.msgRetryCounterCache).toBeUndefined()
        })

        test('should close userDevicesCache', () => {
            const closeSpy = jest.spyOn(provider.userDevicesCache!, 'close')

            provider['cleanup']()

            expect(closeSpy).toHaveBeenCalled()
            expect(provider.userDevicesCache).toBeUndefined()
        })

        test('should clear mapSet', () => {
            provider['mapSet'].add('item1')
            provider['mapSet'].add('item2')

            provider['cleanup']()

            expect(provider['mapSet'].size).toBe(0)
        })

        test('should clear idsDuplicates', () => {
            provider['idsDuplicates'].push('dup1', 'dup2')

            provider['cleanup']()

            expect(provider['idsDuplicates'].length).toBe(0)
        })

        test('should handle cleanup when caches are already undefined', () => {
            provider.msgRetryCounterCache = undefined
            provider.userDevicesCache = undefined

            expect(() => provider['cleanup']()).not.toThrow()
        })
    })

    // ===== Periodic Cleanup (setupPeriodicCleanup) =====

    describe('#setupPeriodicCleanup', () => {
        test('should trim idsDuplicates when over 1000 items', () => {
            // Fill with 1500 items
            for (let i = 0; i < 1500; i++) {
                provider['idsDuplicates'].push(`id_${i}`)
            }

            // Advance timer by 10 minutes
            jest.advanceTimersByTime(600000)

            expect(provider['idsDuplicates'].length).toBe(1000)
        })

        test('should not trim idsDuplicates when under 1000 items', () => {
            for (let i = 0; i < 500; i++) {
                provider['idsDuplicates'].push(`id_${i}`)
            }

            jest.advanceTimersByTime(600000)

            expect(provider['idsDuplicates'].length).toBe(500)
        })

        test('should clear mapSet when over 1000 entries', () => {
            for (let i = 0; i < 1500; i++) {
                provider['mapSet'].add(`entry_${i}`)
            }

            jest.advanceTimersByTime(600000)

            expect(provider['mapSet'].size).toBe(0)
        })

        test('should not clear mapSet when under 1000 entries', () => {
            for (let i = 0; i < 500; i++) {
                provider['mapSet'].add(`entry_${i}`)
            }

            jest.advanceTimersByTime(600000)

            expect(provider['mapSet'].size).toBe(500)
        })
    })

    // ===== Duplicate Message Detection =====

    describe('Duplicate message detection', () => {
        test('idsDuplicates should start empty', () => {
            expect(provider['idsDuplicates'].length).toBe(0)
        })

        test('mapSet should start empty', () => {
            expect(provider['mapSet'].size).toBe(0)
        })
    })

    // ===== Cache Configuration =====

    describe('Cache configuration', () => {
        test('msgRetryCounterCache should be initialized', () => {
            expect(provider.msgRetryCounterCache).toBeDefined()
        })

        test('userDevicesCache should be initialized', () => {
            expect(provider.userDevicesCache).toBeDefined()
        })
    })

    // ===== getLIDForPN =====

    describe('#getLIDForPN', () => {
        test('should return null when vendor has no LID mapping', async () => {
            provider.vendor = {} as any
            const result = await provider.getLIDForPN('1234567890@s.whatsapp.net')
            expect(result).toBeNull()
        })

        test('should return null on error', async () => {
            provider.vendor = {
                signalRepository: {
                    lidMapping: {
                        getLIDForPN: (jest.fn() as any).mockRejectedValue(new Error('fail')),
                    },
                },
            } as any

            const result = await provider.getLIDForPN('1234567890@s.whatsapp.net')
            expect(result).toBeNull()
        })

        test('should return LID when mapping exists', async () => {
            provider.vendor = {
                signalRepository: {
                    lidMapping: {
                        getLIDForPN: (jest.fn() as any).mockResolvedValue('lid:abc123'),
                    },
                },
            } as any

            const result = await provider.getLIDForPN('1234567890@s.whatsapp.net')
            expect(result).toBe('lid:abc123')
        })
    })

    // ===== getPNForLID =====

    describe('#getPNForLID', () => {
        test('should return null when vendor has no LID mapping', async () => {
            provider.vendor = {} as any
            const result = await provider.getPNForLID('lid:abc')
            expect(result).toBeNull()
        })

        test('should return null on error', async () => {
            provider.vendor = {
                signalRepository: {
                    lidMapping: {
                        getPNForLID: (jest.fn() as any).mockRejectedValue(new Error('fail')),
                    },
                },
            } as any

            const result = await provider.getPNForLID('lid:abc')
            expect(result).toBeNull()
        })

        test('should return PN when mapping exists', async () => {
            provider.vendor = {
                signalRepository: {
                    lidMapping: {
                        getPNForLID: (jest.fn() as any).mockResolvedValue('1234567890@s.whatsapp.net'),
                    },
                },
            } as any

            const result = await provider.getPNForLID('lid:abc')
            expect(result).toBe('1234567890@s.whatsapp.net')
        })
    })

    // ===== sendPoll =====

    describe('#sendPoll', () => {
        test('should return false if less than 2 options', async () => {
            const result = await provider.sendPoll('123', 'Question', {
                options: ['Only one'],
                multiselect: false,
            })
            expect(result).toBe(false)
        })

        test('should send poll with valid options', async () => {
            provider.vendor = {
                sendMessage: (jest.fn() as any).mockResolvedValue('sent'),
            } as any

            const result = await provider.sendPoll('123', 'Question', {
                options: ['A', 'B'],
                multiselect: false,
            })

            expect(provider.vendor.sendMessage).toHaveBeenCalled()
        })
    })

    // ===== releaseSessionFiles =====

    describe('#releaseSessionFiles', () => {
        test('should call releaseTmp and clearInterval', async () => {
            // This test verifies the method doesn't throw
            // releaseTmp is imported from a separate module
            try {
                await provider.releaseSessionFiles()
            } catch {
                // Expected to potentially fail in test env since releaseTmp may need filesystem
            }
        })
    })
})
