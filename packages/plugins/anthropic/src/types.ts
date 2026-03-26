/**
 * Opciones de configuracion del plugin Anthropic para BuilderBot
 *
 * @example
 * ```typescript
 * const options: AnthropicContextOptions = {
 *     model: 'claude-sonnet-4-20250514',
 *     maxHistoryLength: 20,
 *     systemPrompt: 'Eres un asistente amable.',
 *     thinking: { enabled: true, budgetTokens: 8000 },
 *     summary: { enabled: true, threshold: 15 },
 * }
 * ```
 */
export interface AnthropicContextOptions {
    /** API key de Anthropic (sk-ant-api03-...). Si no se provee, busca automaticamente en este orden:
     * 1. Variable de entorno ANTHROPIC_API_KEY
     * 2. Variable de entorno ANTHROPIC_AUTH_TOKEN
     * 3. Token OAuth de Claude setup (~/.claude/.credentials.json) generado con `claude setup-token`
     */
    apiKey?: string
    /** Modelo a utilizar. Default: 'claude-sonnet-4-20250514' */
    model?: string
    /** Cantidad maxima de mensajes por usuario en el historial. Default: 10 */
    maxHistoryLength?: number
    /** Maximo de tokens en la respuesta. Default: 4096 */
    maxTokens?: number
    /** Prompt de sistema opcional que define el comportamiento del asistente */
    systemPrompt?: string
    /** Configuracion del modo thinking (razonamiento extendido) */
    thinking?: ThinkingConfig
    /** Configuracion del resumen automatico de conversaciones */
    summary?: SummaryConfig
}

export interface ThinkingConfig {
    /** Habilita el modo de razonamiento extendido */
    enabled: boolean
    /** Presupuesto de tokens para el razonamiento. Default: 10000 */
    budgetTokens?: number
}

export interface SummaryConfig {
    /** Habilita el resumen automatico cuando el historial crece */
    enabled: boolean
    /** Cantidad de mensajes que disparan el resumen. Default: igual a maxHistoryLength */
    threshold?: number
}

export interface ConversationEntry {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    timestamp: number
}

export type ContentBlock = TextBlock | ImageBlock

export interface TextBlock {
    type: 'text'
    text: string
}

export interface ImageBlock {
    type: 'image'
    source: {
        type: 'base64'
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
        data: string
    }
}

export interface MessageContextIncoming {
    from: string
    ref?: string
    body?: string
    [key: string]: any
}

export interface ParamsAnthropic {
    database: any
    provider: any
    options?: AnthropicContextOptions
}
