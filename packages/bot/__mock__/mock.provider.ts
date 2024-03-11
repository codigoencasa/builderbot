import { delay } from './env'
import { ProviderClass } from '../src/index'

class MockProvider extends ProviderClass {
    constructor() {
        super()
    }

    delaySendMessage = async (milliseconds: number, eventName: string, payload: any): Promise<void> => {
        await delay(milliseconds)
        this.emit(eventName, payload)
    }

    sendMessage = async (userId: string, message: string): Promise<any> => {
        console.log(`Enviando... ${userId}, ${message}`)
        return Promise.resolve({ userId, message })
    }
}

export default MockProvider
