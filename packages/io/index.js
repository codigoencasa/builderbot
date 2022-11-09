const { addKeyword, addAnswer } = require('./methods')
const FlowClass = require('./classes/flow.class')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = async (args) => {
    return new FlowClass(args)
}

module.exports = { addKeyword, addAnswer, create }
