import { ProviderClass } from './interface/provider'
import type { ProviderEventTypes } from '../types'
import { delay } from '../utils'

class TestProvider extends ProviderClass {
    protected afterHttpServerInit(): void {}

    public globalVendorArgs = {
        name: '_mock_',
    }

    protected beforeHttpServerInit(): void {}

    protected async initVendor(): Promise<void> {}

    protected busEvents(): { event: string; func: Function }[] {
        return []
    }

    public async saveFile(): Promise<string> {
        return ''
    }

    public async delaySendMessage(
        milliseconds: number,
        eventName: keyof ProviderEventTypes,
        payload: any
    ): Promise<void> {
        await delay(milliseconds)
        this.emit(`${eventName}`, payload)
    }

    public async sendMessage(userId: string, message: string): Promise<any> {
        return Promise.resolve({ userId, message })
    }
}

export { TestProvider }
