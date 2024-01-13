import color from 'picocolors'

type PrinterFunction = (message: string | string[], title?: string) => void

const NODE_ENV: string = process.env.NODE_ENV || 'dev'

/**
 *
 * @param message
 * @param title
 */
const printer: PrinterFunction = (message, title) => {
    if (NODE_ENV !== 'test') {
        if (title) console.log(color.bgRed(`${title}`))
        console.log(color.yellow(Array.isArray(message) ? message.join('\n') : message))
        console.log(``)
    }
}

export { printer }
