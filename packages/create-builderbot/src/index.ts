/**
 * LAYER: Interface
 * Contains: Src
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [Src]
 * GOAL: Own the "src" concern of the create-builderbot package.
 */
import { start } from '@builderbot/cli'
/**
 * Voy a llamar directo a CLI
 * Temporalmente luego mejoro esta
 * parte
 * @returns
 */
export const main = () => start()
