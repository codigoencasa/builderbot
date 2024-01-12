import kleur from 'kleur'

type PrinterFunction = (message: string | string[], title?: string) => void

const NODE_ENV: string = process.env.NODE_ENV || 'dev'

/**
 *
 * @param message
 * @param title
 */
const printer: PrinterFunction = (message, title) => {
    if (NODE_ENV !== 'test') {
        if (title) console.log(kleur.bgRed(`${title}`))
        console.log(kleur.yellow(Array.isArray(message) ? message.join('\n') : message))
        console.log(``)
    }
}

export { printer }
