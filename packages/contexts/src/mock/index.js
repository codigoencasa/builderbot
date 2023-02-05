const MockClass = require('./mock.class')

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotMock = async ({ database, provider }) => new MockClass(database, provider)

module.exports = {
    createBotMock,
    MockClass,
}
