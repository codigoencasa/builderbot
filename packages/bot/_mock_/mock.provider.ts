import { ProviderClass } from '../src/index'
import { delay } from './env'

class MockProvider extends ProviderClass {
    constructor() {
        super()
    }

    delaySendMessage = async (milliseconds: number, eventName: string, payload: Payload): Promise<void> => {
        await delay(milliseconds)
        this.emit(eventName, payload)
    }

    sendMessage = async (userId: string, message: string): Promise<any> => {
        console.log(`Enviando... ${userId}, ${message}`)
        return Promise.resolve({ userId, message })
    }
}

export default MockProvider
