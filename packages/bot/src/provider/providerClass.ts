import { EventEmitter } from 'node:events'

export type Vendor<T = {}> = {} & T

const NODE_ENV = process.env.NODE_ENV || 'dev'

class ProviderClass extends EventEmitter {
    vendor: Vendor = {}
    globalVendorArgs: any

    public async sendMessage<K = any>(userId: string, message: any, args?: any): Promise<K> {
        if (NODE_ENV !== 'production') {
            console.log('[sendMessage]', { userId, message, args })
        }
        return Promise.resolve(message)
    }

    public async saveFile(ctx: any, options?: { path: string }): Promise<string> {
        console.log(`ctx`, ctx)
        console.log(`options`, options)
        console.log(`Ups it is provider don't implement this function`)
        return ``
    }

    public getInstance(): Vendor {
        return this.vendor
    }
}

export { ProviderClass }
