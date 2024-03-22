import { ProviderClass } from './interface/provider'
import type { ProviderEventTypes } from '../types'

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

type PayloadType = any

class ProviderMock extends ProviderClass {
    public indexHome
    protected initVendor(): Promise<any> {
        return Promise.resolve()
    }

    protected busEvents(): { event: string; func: Function }[] {
        return []
    }
    public globalVendorArgs: any

    public saveFile(): Promise<string> {
        return Promise.resolve('')
    }

    protected afterInit(): void {
        console.log('Method not implemented.')
    }

    delaySendMessage = async (
        milliseconds: number,
        eventName: keyof ProviderEventTypes,
        payload: PayloadType
    ): Promise<void> => {
        await delay(milliseconds)
        this.emit(eventName, payload)
    }

    sendMessage = async (userId: string, message: string): Promise<any> => {
        return Promise.resolve({ userId, message })
    }
}

export { ProviderMock }
