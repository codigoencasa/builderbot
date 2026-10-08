/**
 * LAYER: Infrastructure
 * Contains: TestProvider — mock provider for tests and local runs
 * Rules: Implements ProviderClass. Test-only adapter, no business rules.
 * BigO: O(1) score:5
 * keywords: [TestProvider, ProviderClass, ProviderEventTypes]
 * GOAL: Provide a minimal in-memory provider to exercise the runtime without a real channel.
 */
import type { ProviderEventTypes } from '../types'
import { delay } from '../utils'
import { ProviderClass } from './interface/provider'

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
