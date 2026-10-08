import { readFile } from 'node:fs/promises'

import type {
    ChatwootContact,
    ChatwootConversation,
    ChatwootInbox,
    ChatwootMessage,
    ChatwootPluginConfig,
    ChatwootSearchContactsPayload,
} from './types'

/** Minimal MIME lookup by file extension — avoids external dependencies. */
const getContentType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const map: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        ogg: 'audio/ogg',
        opus: 'audio/ogg',
        wav: 'audio/wav',
        pdf: 'application/pdf',
        svg: 'image/svg+xml',
    }
    return map[ext] ?? 'application/octet-stream'
}

class ChatwootApi {
    private baseUrl: string
    private token: string
    private headers: Record<string, string>

    constructor(config: ChatwootPluginConfig) {
        this.baseUrl = `${config.url.replace(/\/$/, '')}/api/v1/accounts/${config.accountId}`
        this.token = config.token
        this.headers = {
            'Content-Type': 'application/json',
            api_access_token: config.token,
        }
    }

    /**
     * Verifica que las credenciales sean válidas contra la API de Chatwoot.
     * Retorna `true` si la cuenta es accesible.
     */
    async checkAccount(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/`, {
                method: 'GET',
                headers: this.headers,
            })
            const data = (await response.json()) as { error?: string }
            return !data?.error
        } catch {
            return false
        }
    }

    /**
     * Crea un inbox tipo API channel en Chatwoot.
     * Si ya existe uno con el mismo nombre, lo retorna.
     */
    async findOrCreateInbox(name: string): Promise<ChatwootInbox> {
        const existing = await this.listInboxes()
        const found = existing.find((inbox) => inbox.name === name)
        if (found) return found

        const response = await fetch(`${this.baseUrl}/inboxes`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name,
                channel: {
                    type: 'api',
                    webhook_url: '',
                },
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating inbox: ${error}`)
        }

        return (await response.json()) as ChatwootInbox
    }

    /**
     * Lista todos los inboxes de la cuenta.
     */
    async listInboxes(): Promise<ChatwootInbox[]> {
        const response = await fetch(`${this.baseUrl}/inboxes`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return []

        const data = (await response.json()) as { payload: ChatwootInbox[] }
        return data?.payload ?? []
    }

    /**
     * Busca un contacto por teléfono. Si no existe, lo crea.
     */
    async findOrCreateContact(phone: string, name?: string): Promise<ChatwootContact> {
        const found = await this.searchContacts(phone)
        if (found) return found

        return this.createContact(phone, name)
    }

    /**
     * Busca contactos por query (teléfono, nombre, email).
     */
    async searchContacts(query: string): Promise<ChatwootContact | null> {
        const response = await fetch(`${this.baseUrl}/contacts/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return null

        const data = (await response.json()) as ChatwootSearchContactsPayload
        return data?.payload?.[0] ?? null
    }

    /**
     * Crea un nuevo contacto en Chatwoot.
     */
    async createContact(phone: string, name?: string): Promise<ChatwootContact> {
        const response = await fetch(`${this.baseUrl}/contacts`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name: name ?? phone,
                phone_number: phone.startsWith('+') ? phone : `+${phone}`,
                identifier: phone,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating contact: ${error}`)
        }

        const data = (await response.json()) as { payload: { contact: ChatwootContact } }
        return data?.payload?.contact ?? (data as unknown as ChatwootContact)
    }

    /**
     * Busca una conversación abierta para un contacto en un inbox.
     * Si no existe, crea una nueva.
     */
    async findOrCreateConversation(contactId: number, inboxId: number): Promise<ChatwootConversation> {
        const existing = await this.getContactConversations(contactId)
        const open = existing.find((conv) => conv.inbox_id === inboxId && conv.status !== 'resolved')
        if (open) return open

        return this.createConversation(contactId, inboxId)
    }

    /**
     * Obtiene las conversaciones de un contacto.
     */
    async getContactConversations(contactId: number): Promise<ChatwootConversation[]> {
        const response = await fetch(`${this.baseUrl}/contacts/${contactId}/conversations`, {
            method: 'GET',
            headers: this.headers,
        })

        if (!response.ok) return []

        const data = (await response.json()) as { payload: ChatwootConversation[] }
        return data?.payload ?? []
    }

    /**
     * Crea una nueva conversación en Chatwoot.
     */
    async createConversation(contactId: number, inboxId: number): Promise<ChatwootConversation> {
        const response = await fetch(`${this.baseUrl}/conversations`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                contact_id: contactId,
                inbox_id: inboxId,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error creating conversation: ${error}`)
        }

        return (await response.json()) as ChatwootConversation
    }

    /**
     * Envía un mensaje a una conversación de Chatwoot.
     * Si se provee `mediaSource` (URL o ruta local), el mensaje se envía con adjunto via FormData.
     */
    async sendMessage(
        conversationId: number,
        content: string,
        messageType: 'incoming' | 'outgoing' = 'incoming',
        mediaSource?: string | null
    ): Promise<ChatwootMessage> {
        if (mediaSource) {
            return this.sendMessageWithMedia(conversationId, content, messageType, mediaSource)
        }

        const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                content,
                message_type: messageType,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error sending message: ${error}`)
        }

        return (await response.json()) as ChatwootMessage
    }

    /**
     * Envía un mensaje con adjunto multimedia a una conversación.
     * `mediaSource` puede ser una URL https:// o una ruta local en disco.
     */
    private async sendMessageWithMedia(
        conversationId: number,
        content: string,
        messageType: 'incoming' | 'outgoing',
        mediaSource: string
    ): Promise<ChatwootMessage> {
        const form = new FormData()
        form.set('content', content)
        form.set('message_type', messageType)

        try {
            const isUrl = mediaSource.startsWith('http://') || mediaSource.startsWith('https://')

            if (isUrl) {
                const mediaResponse = await fetch(mediaSource)
                if (mediaResponse.ok) {
                    const buffer = await mediaResponse.arrayBuffer()
                    const contentType = mediaResponse.headers.get('content-type') ?? 'application/octet-stream'
                    const fileName = mediaSource.split('/').pop()?.split('?')[0] ?? 'file'
                    form.set('attachments[]', new Blob([buffer], { type: contentType }), fileName)
                }
            } else {
                const fileName = mediaSource.split('/').pop() ?? 'file'
                const fileBuffer = await readFile(mediaSource)
                const mimeType = getContentType(fileName)
                form.set('attachments[]', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), fileName)
            }
        } catch (mediaErr) {
            console.error('[Chatwoot] Could not attach media, sending text-only:', mediaErr)
        }

        const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { api_access_token: this.token },
            body: form,
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`[Chatwoot] Error sending message with media: ${error}`)
        }

        return (await response.json()) as ChatwootMessage
    }

    /**
     * Busca un webhook existente cuya URL contenga `matchUrl`.
     */
    async findWebhook(matchUrl: string): Promise<{ id: number; url: string } | null> {
        try {
            const response = await fetch(`${this.baseUrl}/webhooks`, {
                method: 'GET',
                headers: this.headers,
            })

            if (!response.ok) return null

            const data = (await response.json()) as { payload?: { webhooks?: Array<{ id: number; url: string }> } }
            const webhooks = data?.payload?.webhooks ?? []
            return webhooks.find((w) => w.url === matchUrl) ?? null
        } catch {
            return null
        }
    }

    /**
     * Crea un webhook en Chatwoot.
     */
    async createWebhook(url: string, subscriptions: string[]): Promise<void> {
        try {
            const response = await fetch(`${this.baseUrl}/webhooks`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({ webhook: { url, subscriptions } }),
            })

            if (!response.ok) {
                const error = await response.text()
                console.error(`[Chatwoot] Error creating webhook: ${error}`)
            }
        } catch (err) {
            console.error('[Chatwoot] Error creating webhook:', err)
        }
    }
}

export { ChatwootApi }
