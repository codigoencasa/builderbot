const { writeFile } = require('fs').promises
const { join } = require('path')

/**
 * JSON_TEMPLATE = {[key:string]{...pros}}
 */
const JSON_TEMPLATE = {
    provider: {
        vendor: '',
    },
    database: {
        host: '',
        password: '',
        port: '',
        username: '',
        db: '',
    },
    io: {
        vendor: '',
    },
}

const PATH_CONFIG = join(process.cwd(), 'config.json')

const jsonConfig = () => {
    return writeFile(PATH_CONFIG, JSON.stringify(JSON_TEMPLATE, null, 2), 'utf-8')
}

module.exports = { jsonConfig }
