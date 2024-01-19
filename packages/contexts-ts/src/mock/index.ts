import { MockContext } from './mock.class'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotMock = async ({ database, provider }) => new MockContext(database, provider)

export { createBotMock, MockContext }
