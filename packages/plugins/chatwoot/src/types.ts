/**
 * Configuración principal del plugin de Chatwoot.
 * Solo necesitas `token`, `url` y `accountId` para empezar.
 */
export interface ChatwootPluginConfig {
    /** API access token de Chatwoot (User o Agent token) */
    token: string
    /** URL base de tu instancia de Chatwoot (ej: https://app.chatwoot.com) */
    url: string
    /** ID de la cuenta en Chatwoot */
    accountId: number
    /** Nombre del inbox que se creará automáticamente (default: 'BuilderBot Inbox') */
    inboxName?: string
    /**
     * URL pública donde Chatwoot enviará webhooks hacia el bot.
     * Si se provee, el plugin registrará (o reutilizará) el webhook automáticamente.
     * Ej: 'https://mi-bot.example.com/v1/chatwoot'
     */
    webhookUrl?: string
}

export interface ChatwootContact {
    id?: number
    name?: string
    phone_number?: string
    email?: string
    identifier?: string
    contact_inboxes?: Array<{ inbox: { id: number } }>
}

export interface ChatwootConversation {
    id: number
    inbox_id: number
    contact_id: number
    status?: string
    account_id?: number
}

export interface ChatwootInbox {
    id: number
    name: string
    channel_type?: string
    webhook_url?: string
}

export interface ChatwootMessage {
    id?: number
    content: string
    message_type: 'incoming' | 'outgoing'
    content_type?: string
    private?: boolean
}

export interface ChatwootSearchContactsPayload {
    payload: ChatwootContact[]
}

export interface BotIncomingMessagePayload {
    from: string
    body: string
    name?: string
    options?: { media?: string }
    /**
     * Raw provider-specific message context. Baileys spreads the full WAMessage
     * here, which is needed by `provider.saveFile` to download media when
     * `options.media` is not populated.
     */
    [key: string]: unknown
}

/**
 * Duck-typed interface for providers that can download incoming media to disk.
 * Baileys exposes this as `provider.saveFile(ctx)` returning a local file path.
 */
export interface BotProviderWithSaveFile {
    saveFile(ctx: BotIncomingMessagePayload, options?: { path?: string }): Promise<string>
}

/**
 * Duck-typed interface for the bot fields used by handleWebhook.
 * Combine with CoreClass: `bot: CoreClass & ChatwootBotRef`.
 */
export interface ChatwootBotRef {
    blacklist?: {
        add(phone: string): void
        remove(phone: string): void
        checkIf(phone: string): boolean
    }
    sendMessage(number: string, message: string, options?: { media?: string | null }): Promise<unknown>
}

/**
 * Minimal shape of the send_message event payload for accessing options.media.
 * The full payload is inferred from HostEventTypes; this covers only what the plugin needs.
 */
export interface BotOutgoingPayload {
    from?: string
    answer?: string | string[]
    options?: { media?: string | null }
}

/** Shape of the webhook body that Chatwoot POSTs to the bot */
export interface ChatwootWebhookBody {
    event?: string
    message_type?: string
    private?: boolean
    content?: string
    attachments?: Array<{ data_url?: string; [key: string]: unknown }>
    changed_attributes?: Array<Record<string, unknown>>
    meta?: {
        sender?: { phone_number?: string; name?: string }
        assignee?: { id?: number } | null
    }
    conversation?: {
        id?: number
        inbox_id?: number
        channel?: string
        status?: string
        meta?: {
            sender?: { phone_number?: string; name?: string }
            assignee?: { id?: number } | null
        }
        contact_inbox?: { inbox_id?: number }
        messages?: Array<{ inbox_id?: number }>
    }
    inbox?: { id?: number }
    sender?: { phone_number?: string; type?: string }
    account?: { id?: number }
}
