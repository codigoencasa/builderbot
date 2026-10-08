/**
 * LAYER: Interface
 * Contains: Src
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [Src]
 * GOAL: Own the "src" concern of the cli package.
 */
import { start } from './interactive'
if (process.env.NODE_ENV === 'dev') start()
export { start }
