/**
 * Build a deterministic-ish file name for a saved audio utterance.
 */
export const generateAudioFileName = (from: string, ext = 'wav'): string => {
    const safeFrom = from.replace(/[^a-zA-Z0-9_-]/g, '')
    return `${Date.now()}-${safeFrom}.${ext}`
}
