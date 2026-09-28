/**
 * LAYER: Infrastructure
 * Contains: Mock, MockContext
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Mock, MockContext]
 * GOAL: Own the "mock" concern of the contexts-dialogflow package.
 */
import { MockContext } from './mock.class'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotMock = async ({ database, provider }) => new MockContext(database, provider)

export { createBotMock, MockContext }
