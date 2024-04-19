import { MemoryDB } from '../src/db'
import { TestProvider } from '../src/provider/providerMock'

interface Callbacks {
    ref: () => number
}

type Answer = {
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
const setup = async (context: { [key: string]: any }): Promise<void> => {
    context.provider = new TestProvider()
    context.database = new MemoryDB()
    context.flow = new MockFlow()
    await delay(10)
}

const clear = async (context: any): Promise<void> => {
    context.provider = null
    context.database = null
    context.flow = null
}

/**
 *
 * @param answers
 * @returns
 */
const parseAnswers = (answers: any[]) => {
    // return answers
    return answers.filter(
        (a) =>
            !a.answer.includes('__call_action__') &&
            !a.answer.includes('__goto_flow__') &&
            !a.answer.includes('__end_flow__') &&
            !a.answer.includes('__capture_only_intended__')
    )
}

const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export { setup, clear, delay, parseAnswers }
