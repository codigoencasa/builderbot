const crypto = require('crypto')

const generateRef = () => {
    return crypto.randomUUID()
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
