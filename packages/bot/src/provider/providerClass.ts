import { EventEmitter } from 'node:events'

export type Vendor<T = {}> = {} & T

const NODE_ENV = process.env.NODE_ENV || 'dev'

class ProviderClass extends EventEmitter {
    protected vendor: Vendor = {}

    public async sendMessage<K = any>(userId: string | number, message: any): Promise<K> {
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
