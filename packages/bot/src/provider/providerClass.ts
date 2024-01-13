import { EventEmitter } from 'node:events'

export type UserId = string | number

export interface Message {
    message: string
    userId?: UserId
}

interface Vendor extends Object {}

const NODE_ENV = process.env.NODE_ENV || 'dev'

class ProviderClass extends EventEmitter {
    private vendor: Vendor

    constructor() {
        super()
        this.vendor = {}
    }

    public async sendMessage(userId: UserId, message: Message): Promise<Message> {
        if (NODE_ENV !== 'production') {
            console.log('[sendMessage]', { userId, message })
        }
        return Promise.resolve(message)
    }

    public getInstance(): Vendor {
        return this.vendor
    }
}

export { ProviderClass }
