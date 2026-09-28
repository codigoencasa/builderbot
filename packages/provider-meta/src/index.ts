/**
 * LAYER: Interface
 * Contains: Package entry point (public exports)
 * Rules: Re-exports only; defines the package's public surface.
 * BigO: O(1) score:5
 * keywords: [MetaProvider, processIncomingMessage, MessageStatusEvent]
 * GOAL: Publish the Meta provider, its utilities, and its types as the package API.
 */
export { MetaProvider } from './meta/provider'
export * from './utils/processIncomingMsg'
export * from './types'
