const DatabaseClass = require('./classes/database.class')

/**
 * Crear instancia de clase
 * @param {*} args
 * @returns
 */
const create = (args) => {
    return new DatabaseClass(args)
}

module.exports = { create }
