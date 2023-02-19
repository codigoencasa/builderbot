const crypto = require('crypto')

/**
 * Generamos un UUID unico con posibilidad de tener un prefijo
 * @param {*} prefix
 * @returns
 */
const generateRefprovider = (prefix = false) => {
    const id = crypto.randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

module.exports = { generateRefprovider }
