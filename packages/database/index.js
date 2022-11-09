const DatabaseClass = require('./classes/database.class')
const MockDatabase = require('./adapters/mock')

const prepareEngine = ({ engine, credentials }) => {
    // if (engine === 'mysql') return new TwilioProvider(credentials)
    // if (engine === 'meta') return new TwilioProvider(credentials)
    // if (engine === 'wev') return new TwilioProvider(credentials)
    return new MockDatabase()
}

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = (args) => {
    const engine = prepareEngine(args)
    return new DatabaseClass(engine)
}

module.exports = { create }
