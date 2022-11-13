const crypto = require('crypto')

const generateRef = () => {
    return crypto.randomUUID()
}

module.exports = { generateRef }
