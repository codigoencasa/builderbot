/**
 * Pure SDP manipulation utilities for the WhatsApp voice provider.
 *
 * These functions are stateless and have no external dependencies so they can
 * be unit-tested in full isolation.
 */

/**
 * Rewrite `a=setup:actpass` to `a=setup:active` in an SDP string.
 *
 * Meta's WebRTC gateway requires the answering side to adopt the `active` DTLS
 * role. The `RTCPeerConnection.createAnswer()` produced by `@roamhq/wrtc` will
 * sometimes advertise `actpass`, which Meta silently rejects. This function
 * performs the replacement and validates that the line exists.
 *
 * @param sdp Raw SDP string as returned by `RTCPeerConnection.createAnswer()`.
 * @returns The rewritten SDP with `a=setup:active`.
 * @throws {Error} When the SDP does not contain any `a=setup:` line.
 *
 * @example
 * const answer = await pc.createAnswer()
 * const transformed = transformAnswer(answer.sdp)
 * // transformed will never contain 'actpass'
 */
export const transformAnswer = (sdp: string): string => {
    if (!sdp.includes('a=setup:')) {
        throw new Error(
            '[provider-voice-whatsapp] SDP answer does not contain an `a=setup:` line. ' +
                'Cannot set DTLS role to active. Verify that @roamhq/wrtc is producing a valid answer SDP.'
        )
    }
    return sdp.replace(/a=setup:actpass/g, 'a=setup:active')
}

/**
 * Assert that the Opus codec is advertised in the SDP.
 *
 * WhatsApp Business voice calls use Opus. If the SDP answer does not include
 * Opus it will be rejected or result in a one-sided audio stream. This check
 * guards against codec negotiation failures early in the call setup flow.
 *
 * @param sdp SDP string to inspect (offer or answer).
 * @throws {Error} When the Opus codec is absent from the SDP.
 *
 * @example
 * assertOpus(answer.sdp) // throws if Opus is missing
 */
export const assertOpus = (sdp: string): void => {
    // Opus appears as either "opus" (lowercase, per RFC) or "OPUS" in some implementations.
    if (!/opus/i.test(sdp)) {
        throw new Error(
            '[provider-voice-whatsapp] SDP answer does not advertise the Opus codec. ' +
                'WhatsApp Business calling requires Opus. ' +
                'Ensure the WebRTC peer connection is configured to include Opus in its codec list.'
        )
    }
}
