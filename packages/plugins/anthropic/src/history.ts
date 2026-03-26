import type { ConversationEntry, ContentBlock } from './types'

/**
 * Gestiona el historial de conversaciones por usuario.
 * Almacena mensajes en memoria con un limite configurable por usuario.
 */
export class ConversationHistory {
    private store = new Map<string, ConversationEntry[]>()
    private maxLength: number

    constructor(maxLength: number = 10) {
        this.maxLength = maxLength
    }

    /**
     * Agrega una entrada al historial de un usuario.
     * Si se excede el limite, elimina los mensajes mas antiguos.
     */
    addEntry(from: string, role: 'user' | 'assistant', content: string | ContentBlock[]): void {
        const history = this.getHistory(from)
        history.push({ role, content, timestamp: Date.now() })

        if (history.length > this.maxLength) {
            const excess = history.length - this.maxLength
            history.splice(0, excess)
        }

        this.store.set(from, history)
    }

    /** Obtiene el historial completo de un usuario */
    getHistory(from: string): ConversationEntry[] {
        if (!this.store.has(from)) {
            this.store.set(from, [])
        }
        return this.store.get(from)!
    }

    /** Convierte el historial a formato de mensajes Anthropic */
    toAnthropicMessages(from: string): Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }> {
        return this.getHistory(from).map(({ role, content }) => ({ role, content }))
    }

    /** Reemplaza el historial de un usuario con uno nuevo (usado al resumir) */
    replaceHistory(from: string, entries: ConversationEntry[]): void {
        this.store.set(from, entries)
    }

    /** Limpia el historial de un usuario */
    clear(from: string): void {
        this.store.delete(from)
    }

    /** Limpia el historial de todos los usuarios */
    clearAll(): void {
        this.store.clear()
    }

    /** Retorna la cantidad de mensajes en el historial de un usuario */
    size(from: string): number {
        return this.getHistory(from).length
    }
}
