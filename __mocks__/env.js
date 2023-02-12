const MOCK_DB = require('../packages/database/src/mock')
const PROVIDER_DB = require('../packages/provider/src/mock')

class MOCK_FLOW {
    allCallbacks = { ref: () => 1 }
    flowSerialize = []
    flowRaw = []
    find = (arg) => {
        if (arg) {
            return [{ answer: 'answer', ref: 'ref' }]
        } else {
            return null
        }
    }
    findBySerialize = () => ({})
    findIndexByRef = () => 0
}

const cleaName = (name) => {
    name = name.toLowerCase()
    name = name.replaceAll(' ', '-')
    name = name.replaceAll(':', '-')
    name = name.replaceAll('"', '-')
    return name
}

/**
 * Preparar env para el test
 * @param {*} context
 */
const setup = async (context) => {
    const name = cleaName(`${context.__suite__}-${context.__test__}`)
    const filename = `test-${name}.json`
    context.provider = new PROVIDER_DB()
    context.database = new MOCK_DB({ filename })
    context.flow = new MOCK_FLOW()
    await delay(10)
}

const clear = async (context) => {
    context.provider = null
    context.database = null
    context.flow = null
}

function delay(ms) {
    return new Promise((res) => setTimeout(res, ms))
}

module.exports = { setup, clear, delay }
