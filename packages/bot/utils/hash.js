const crypto = require('crypto')

/**
 * Generamos un UUID unico con posibilidad de tener un prefijo
 * @param {*} prefix
 * @returns
 */
const generateRef = (prefix = false) => {
    const id = crypto.randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

/**
 * Genera un HASH MD5
 * @param {*} param0
 * @returns
 */
const generateRefSerialize = ({ index, answer }) =>
    crypto
        .createHash('md5')
        .update(JSON.stringify({ index, answer }))
        .digest('hex')

module.exports = { generateRef, generateRefSerialize }
