/**
 * LAYER: Infrastructure
 * Contains: Src
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Src]
 * GOAL: Own the "src" concern of the provider-voice-sip package.
 */
export { SIPProvider } from './sip/provider'
export type { ISIPProviderArgs, SIPPayload } from './types'
