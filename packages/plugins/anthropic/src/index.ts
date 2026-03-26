import { AnthropicContext } from './anthropic.class'
import type { ParamsAnthropic } from './types'

/**
 * Crea una instancia del plugin Anthropic para BuilderBot.
 *
 * @example
 * ```typescript
 * import { createBotAnthropic } from '@builderbot/plugin-anthropic'
 *
 * // Configuracion minima (usa ANTHROPIC_API_KEY del entorno)
 * const anthropic = await createBotAnthropic({ database, provider })
 *
 * // Configuracion completa
 * const anthropic = await createBotAnthropic({
 *     database,
 *     provider,
 *     options: {
 *         apiKey: 'sk-ant-...',
 *         model: 'claude-sonnet-4-20250514',
 *         maxHistoryLength: 20,
 *         maxTokens: 4096,
 *         systemPrompt: 'Eres un asistente amable para WhatsApp.',
 *         thinking: { enabled: true, budgetTokens: 8000 },
 *         summary: { enabled: true, threshold: 15 },
 *     }
 * })
 * ```
 */
const createBotAnthropic = async ({ database, provider, options }: ParamsAnthropic) =>
    new AnthropicContext(database, provider, options)

export { createBotAnthropic, AnthropicContext }
export type { AnthropicContextOptions, ParamsAnthropic, ThinkingConfig, SummaryConfig } from './types'
