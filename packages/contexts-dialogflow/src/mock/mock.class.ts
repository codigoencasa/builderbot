/**
 * LAYER: Infrastructure
 * Contains: MockContext, CoreClass
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [MockContext, CoreClass]
 * GOAL: Own the "mock class" concern of the contexts-dialogflow package.
 */
import { CoreClass } from '@builderbot/bot'

export class MockContext extends CoreClass {
    constructor(_database, _provider) {
        super(null, _database, _provider, null)
    }

    init = () => {}

    /**
     * GLOSSARY.md
     * @param {*} messageCtxInComming
     * @returns
     */
    handleMsg = async (): Promise<any> => {
        console.log('DEBUG:')
    }
}
