import { beforeEach, describe, expect, jest, test } from '@jest/globals'

import * as wrapper from '../src/baileyWrapper'
import { BUNDLED_WA_VERSION, parseWaVersion, resolveWaVersion } from '../src/waVersion'

jest.mock('../src/baileyWrapper', () => ({
    fetchLatestBaileysVersion: jest.fn(),
    fetchLatestWaWebVersion: jest.fn(),
}))

const baileysLookup = jest.mocked(wrapper.fetchLatestBaileysVersion)
const waWebLookup = jest.mocked(wrapper.fetchLatestWaWebVersion)

describe('#parseWaVersion', () => {
    const valid: [string, unknown][] = [
        ['array', [2, 3000, 1054953954]],
        ['dotted text', '2.3000.1054953954'],
        ['wppconnect text with -alpha', '2.3000.1054953954-alpha'],
        ['comma separated (env style)', '2,3000,1054953954'],
        ['array literal text', '[2, 3000, 1054953954]'],
        ['surrounding spaces', '  2.3000.1054953954  '],
    ]
    for (const [name, input] of valid) {
        test(`parses ${name}`, () => {
            expect(parseWaVersion(input)).toEqual([2, 3000, 1054953954])
        })
    }

    const invalid: [string, unknown][] = [
        ['undefined', undefined],
        ['empty text', ''],
        ['two parts', '2.3000'],
        ['four parts', '2.3000.1054953954.1'],
        ['non numeric', 'latest'],
        ['array with text', [2, 3000, 'x']],
        ['negative', [2, 3000, -1]],
        ['number', 1054953954],
    ]
    for (const [name, input] of invalid) {
        test(`rejects ${name}`, () => {
            expect(parseWaVersion(input)).toBeUndefined()
        })
    }
})

describe('#resolveWaVersion', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        baileysLookup.mockResolvedValue({ version: [2, 3000, 1043857760], isLatest: true })
        waWebLookup.mockResolvedValue({ version: [2, 3000, 1055185710], isLatest: true })
    })

    test('uses the manual version without any network lookup', async () => {
        const result = await resolveWaVersion({ manual: [2, 3000, 1054953954] })
        expect(result).toEqual({ version: [2, 3000, 1054953954], source: 'manual' })
        expect(baileysLookup).not.toHaveBeenCalled()
        expect(waWebLookup).not.toHaveBeenCalled()
    })

    test('prefers the Baileys-recommended version by default', async () => {
        const result = await resolveWaVersion()
        expect(result).toEqual({ version: [2, 3000, 1043857760], source: 'baileys' })
        expect(waWebLookup).not.toHaveBeenCalled()
    })

    test('falls back to WhatsApp Web when the Baileys lookup reports an error', async () => {
        // Baileys never throws: it returns the bundled version with `error` set
        baileysLookup.mockResolvedValue({ version: [2, 3000, 1], isLatest: false, error: new Error('offline') })
        const result = await resolveWaVersion()
        expect(result).toEqual({ version: [2, 3000, 1055185710], source: 'wa-web' })
    })

    test('falls back to WhatsApp Web when the Baileys lookup throws', async () => {
        baileysLookup.mockRejectedValue(new Error('boom'))
        const result = await resolveWaVersion()
        expect(result.source).toBe('wa-web')
    })

    test('falls back to the bundled version when every lookup fails', async () => {
        baileysLookup.mockResolvedValue({ version: [2, 3000, 1], isLatest: false, error: new Error('offline') })
        waWebLookup.mockResolvedValue({ version: [2, 3000, 1], isLatest: false, error: { message: 'no revision' } })
        const result = await resolveWaVersion()
        expect(result).toEqual({ version: BUNDLED_WA_VERSION, source: 'bundled' })
    })

    test('a hanging lookup is cut by the timeout', async () => {
        baileysLookup.mockImplementation(() => new Promise(() => {}))
        const result = await resolveWaVersion({ timeoutMs: 20 })
        expect(result.source).toBe('wa-web')
    })

    test('after a 405 the manual version is skipped and WhatsApp Web goes first', async () => {
        const result = await resolveWaVersion({ manual: [2, 3000, 1035824857], preferLive: true })
        expect(result).toEqual({ version: [2, 3000, 1055185710], source: 'wa-web' })
        expect(baileysLookup).not.toHaveBeenCalled()
    })
})
