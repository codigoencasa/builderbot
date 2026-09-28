/**
 * LAYER: Infrastructure
 * Contains: Utils
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Utils]
 * GOAL: Own the "utils" concern of the provider-voice-sip package.
 */
/**
 * Build a deterministic-ish file name for a saved audio utterance.
 */
export const generateAudioFileName = (from: string, ext = 'wav'): string => {
    const safeFrom = from.replace(/[^a-zA-Z0-9_-]/g, '')
    return `${Date.now()}-${safeFrom}.${ext}`
}
