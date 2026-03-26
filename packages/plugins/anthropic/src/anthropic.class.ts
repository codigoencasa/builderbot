import Anthropic from '@anthropic-ai/sdk'
import { CoreClass } from '@builderbot/bot'

import { ConversationHistory } from './history'
import type { AnthropicContextOptions, ContentBlock, MessageContextIncoming, TextBlock, ImageBlock } from './types'
import { fileToBase64, getImageMediaType, isImageFile, isAudioFile, isVideoFile, isPdfFile } from './utils'

const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const DEFAULT_MAX_HISTORY = 10
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_THINKING_BUDGET = 10000

export class AnthropicContext extends CoreClass {
    private client: Anthropic
    private history: ConversationHistory
    private options: Required<
        Pick<AnthropicContextOptions, 'model' | 'maxHistoryLength' | 'maxTokens'>
    > &
        AnthropicContextOptions

    constructor(_database: any, _provider: any, _optionsDX: AnthropicContextOptions = {}) {
        super(null, _database, _provider, null)
        this.options = {
            model: DEFAULT_MODEL,
            maxHistoryLength: DEFAULT_MAX_HISTORY,
            maxTokens: DEFAULT_MAX_TOKENS,
            ..._optionsDX,
        }
        this.init()
    }

    private init(): void {
        const apiKey = this.options.apiKey || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            throw new Error(
                'Anthropic API key no encontrada. Proporciona apiKey en las opciones o define la variable de entorno ANTHROPIC_API_KEY.'
            )
        }
        this.client = new Anthropic({ apiKey })
        this.history = new ConversationHistory(this.options.maxHistoryLength)
    }

    /**
     * Procesa un mensaje entrante, lo envia a Claude y responde al usuario.
     */
    handleMsg = async (messageCtxInComming: MessageContextIncoming): Promise<any> => {
        const { from, body } = messageCtxInComming
        const userContent = await this.buildUserContent(messageCtxInComming)

        this.history.addEntry(from, 'user', userContent)

        const responseText = await this.chat(from)

        this.history.addEntry(from, 'assistant', responseText)

        await this.handleSummary(from)

        this.sendFlowSimple([{ answer: responseText }], from)
    }

    /**
     * Construye el contenido del mensaje del usuario, incluyendo media si existe.
     */
    private async buildUserContent(ctx: MessageContextIncoming): Promise<string | ContentBlock[]> {
        const { body } = ctx
        const mediaUrl: string | undefined = ctx.url || ctx.media

        if (!mediaUrl) {
            return body || ''
        }

        try {
            const filePath = await this.provider?.saveFile?.(ctx, { path: process.cwd() })
            if (!filePath) {
                return body || ''
            }

            if (isImageFile(filePath)) {
                return this.buildImageContent(filePath, body)
            }

            if (isAudioFile(filePath)) {
                const blocks: ContentBlock[] = [
                    { type: 'text', text: `[El usuario envio un mensaje de audio]${body ? `\n\nTexto adjunto: ${body}` : ''}` },
                ]
                return blocks
            }

            if (isVideoFile(filePath)) {
                const blocks: ContentBlock[] = [
                    { type: 'text', text: `[El usuario envio un video]${body ? `\n\nTexto adjunto: ${body}` : ''}` },
                ]
                return blocks
            }

            if (isPdfFile(filePath)) {
                return this.buildPdfContent(filePath, body)
            }
        } catch {
            // Si falla el procesamiento de media, enviar solo texto
        }

        return body || ''
    }

    private buildImageContent(filePath: string, body?: string): ContentBlock[] {
        const base64 = fileToBase64(filePath)
        const mediaType = getImageMediaType(filePath)
        const blocks: ContentBlock[] = [
            {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
            } as ImageBlock,
        ]
        if (body) {
            blocks.push({ type: 'text', text: body } as TextBlock)
        }
        return blocks
    }

    private buildPdfContent(filePath: string, body?: string): any[] {
        const base64 = fileToBase64(filePath)
        const blocks: any[] = [
            {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
        ]
        if (body) {
            blocks.push({ type: 'text', text: body })
        }
        return blocks
    }

    /**
     * Envia el historial de conversacion a la API de Anthropic y retorna la respuesta.
     */
    private async chat(from: string): Promise<string> {
        const messages = this.history.toAnthropicMessages(from)
        const { model, maxTokens, systemPrompt, thinking } = this.options

        const params: any = {
            model,
            max_tokens: maxTokens,
            messages,
        }

        if (systemPrompt) {
            params.system = systemPrompt
        }

        if (thinking?.enabled) {
            const budgetTokens = thinking.budgetTokens ?? DEFAULT_THINKING_BUDGET
            params.thinking = { type: 'enabled', budget_tokens: budgetTokens }
            // Cuando thinking esta habilitado, max_tokens debe ser mayor que budget_tokens
            if (params.max_tokens <= budgetTokens) {
                params.max_tokens = budgetTokens + DEFAULT_MAX_TOKENS
            }
        }

        const response = await this.client.messages.create(params)

        // Extraer solo bloques de texto de la respuesta (ignorar bloques de thinking)
        const textBlocks = response.content.filter((block: any) => block.type === 'text')
        return textBlocks.map((block: any) => block.text).join('\n') || ''
    }

    /**
     * Si el resumen esta habilitado y el historial excede el umbral,
     * resume los mensajes antiguos en un solo mensaje de contexto.
     */
    private async handleSummary(from: string): Promise<void> {
        const { summary, maxHistoryLength } = this.options
        if (!summary?.enabled) return

        const threshold = summary.threshold ?? maxHistoryLength
        const historySize = this.history.size(from)

        if (historySize <= threshold) return

        const history = this.history.getHistory(from)
        const keepCount = Math.floor(threshold / 2)
        const oldMessages = history.slice(0, historySize - keepCount)
        const recentMessages = history.slice(historySize - keepCount)

        const summaryText = await this.generateSummary(oldMessages)

        const summaryEntry = {
            role: 'user' as const,
            content: `[Resumen de la conversacion anterior]: ${summaryText}`,
            timestamp: Date.now(),
        }

        this.history.replaceHistory(from, [summaryEntry, ...recentMessages])
    }

    private async generateSummary(
        messages: Array<{ role: string; content: string | ContentBlock[] }>
    ): Promise<string> {
        const conversationText = messages
            .map((m) => {
                const text = typeof m.content === 'string' ? m.content : '[contenido multimedia]'
                return `${m.role}: ${text}`
            })
            .join('\n')

        const response = await this.client.messages.create({
            model: this.options.model,
            max_tokens: 500,
            system: 'Resume la siguiente conversacion de forma concisa, capturando los puntos clave y el contexto importante. Responde solo con el resumen.',
            messages: [{ role: 'user', content: conversationText }],
        })

        const textBlocks = response.content.filter((block: any) => block.type === 'text')
        return textBlocks.map((block: any) => block.text).join('\n') || ''
    }

    /** Limpia el historial de un usuario especifico */
    clearHistory(from: string): void {
        this.history.clear(from)
    }

    /** Limpia el historial de todos los usuarios */
    clearAllHistory(): void {
        this.history.clearAll()
    }
}
