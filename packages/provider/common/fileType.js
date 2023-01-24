const mimeDep = require('mime-types')
/**
 * Extrar el mimetype from buffer
 * @param {string} response
 * @returns
 */
const fileTypeFromFile = async (response) => {
    const type = response.headers['content-type'] ?? null
    const ext = mimeDep.extension(type)
    return {
        type,
        ext,
    }
}

module.exports = { fileTypeFromFile }
