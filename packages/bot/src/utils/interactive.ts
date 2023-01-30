const { yellow, bgRed } = require('kleur')

const NODE_ENV = process.env.NODE_ENV || 'dev'

export const printer = (message: any, title?: string) => {
    if (NODE_ENV !== 'test') {
        // console.clear()
        if (title) console.log(bgRed(`${title}`))
        console.log(
            yellow(Array.isArray(message) ? message.join('\n') : message)
        )
        console.log(``)
    }
}
