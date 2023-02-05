const { yellow, bgRed } = require('kleur')
const NODE_ENV = process.env.NODE_ENV || 'dev'
const printer = (message, title) => {
    if (NODE_ENV !== 'test') {
        // console.clear()
        if (title) console.log(bgRed(`${title}`))
        console.log(yellow(Array.isArray(message) ? message.join('\n') : message))
        console.log(``)
    }
}

module.exports = { printer }
