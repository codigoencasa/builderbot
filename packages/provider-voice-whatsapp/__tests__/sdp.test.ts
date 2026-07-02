import { describe, expect, test } from '@jest/globals'

import { assertOpus, transformAnswer } from '../src/sdp'

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Minimal SDP answer containing actpass and Opus. */
const SDP_WITH_ACTPASS_AND_OPUS = `v=0
o=- 12345 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=setup:actpass
a=fingerprint:sha-256 AA:BB:CC
a=ice-ufrag:test
a=ice-pwd:test
`

/** SDP with active (already transformed). */
const SDP_WITH_ACTIVE_AND_OPUS = `v=0
o=- 12345 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=setup:active
a=fingerprint:sha-256 AA:BB:CC
a=ice-ufrag:test
a=ice-pwd:test
`

/** SDP without any a=setup: line. */
const SDP_WITHOUT_SETUP = `v=0
o=- 12345 2 IN IP4 127.0.0.1
s=-
t=0 0
m=audio 9 UDP/TLS/RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtpmap:111 opus/48000/2
`

/** SDP without Opus. */
const SDP_WITHOUT_OPUS = `v=0
o=- 12345 2 IN IP4 127.0.0.1
s=-
t=0 0
m=audio 9 UDP/TLS/RTP/SAVPF 0
c=IN IP4 0.0.0.0
a=rtpmap:0 PCMU/8000
a=setup:actpass
`

// ── transformAnswer tests ─────────────────────────────────────────────────────

describe('#transformAnswer', () => {
    test('replaces a=setup:actpass with a=setup:active', () => {
        const result = transformAnswer(SDP_WITH_ACTPASS_AND_OPUS)
        expect(result).toContain('a=setup:active')
    })

    test('output does not contain actpass after transformation', () => {
        const result = transformAnswer(SDP_WITH_ACTPASS_AND_OPUS)
        expect(result).not.toContain('actpass')
    })

    test('is idempotent when SDP already has a=setup:active', () => {
        const result = transformAnswer(SDP_WITH_ACTIVE_AND_OPUS)
        expect(result).toContain('a=setup:active')
        expect(result).not.toContain('actpass')
    })

    test('throws when SDP has no a=setup: line', () => {
        expect(() => transformAnswer(SDP_WITHOUT_SETUP)).toThrow()
    })

    test('throws with a descriptive error message when a=setup: is missing', () => {
        expect(() => transformAnswer(SDP_WITHOUT_SETUP)).toThrow(/a=setup:/)
    })
})

// ── assertOpus tests ──────────────────────────────────────────────────────────

describe('#assertOpus', () => {
    test('does not throw when Opus is present in the SDP', () => {
        expect(() => assertOpus(SDP_WITH_ACTPASS_AND_OPUS)).not.toThrow()
    })

    test('does not throw when Opus is already in transformed SDP', () => {
        expect(() => assertOpus(SDP_WITH_ACTIVE_AND_OPUS)).not.toThrow()
    })

    test('throws when Opus codec is absent from the SDP', () => {
        expect(() => assertOpus(SDP_WITHOUT_OPUS)).toThrow()
    })

    test('throws with a descriptive error message mentioning Opus', () => {
        expect(() => assertOpus(SDP_WITHOUT_OPUS)).toThrow(/[Oo]pus/)
    })
})
