import { DatabaseMock } from '../src/db/'
import { ProviderMock } from '../src/provider/providerMock'

interface Callbacks {
    ref: () => number
}

interface Answer {
    answer: string
    ref: string
}

class MockFlow {
    allCallbacks: Callbacks = { ref: () => 1 }
    flowSerialize: unknown[] = []
    flowRaw: unknown[] = []

    find(arg?: unknown): Answer[] | null {
        if (arg) {
            return [{ answer: 'answer', ref: 'ref' }]
        } else {
            return null
        }
    }

    findBySerialize(): Record<string, unknown> {
        return {}
    }

    findIndexByRef(): number {
        return 0
    }
}

/**
 * Prepare environment for the test
 * @param context The test context
 */
const setup = async (context: any): Promise<void> => {
    context.provider = new ProviderMock()
    context.database = new DatabaseMock()
    context.flow = new MockFlow()
    await delay(10)
}

const clear = async (context: any): Promise<void> => {
    context.provider = null
    context.database = null
    context.flow = null
}

const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export { setup, clear, delay }
