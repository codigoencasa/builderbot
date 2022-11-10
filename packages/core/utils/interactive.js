const { yellow, red, bgRed } = require('kleur')

const printer = (message, title) => {
    console.clear()
    if (title) console.log(bgRed(`${title}`))
    console.log(yellow(Array.isArray(message) ? message.join('\n') : message))
    console.log(``)
}

module.exports = { printer }
