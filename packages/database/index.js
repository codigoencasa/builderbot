const DatabaseClass = require('./classes/database.class')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = async (engineClass) => {
    return new DatabaseClass(engineClass)
}

module.exports = { create }
