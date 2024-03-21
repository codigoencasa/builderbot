import color from 'picocolors'

type PrinterFunction = (message: string | string[], title: string, cName?: 'bgMagenta' | 'bgRed' | 'bgCyan') => void

const NODE_ENV: string = process.env.NODE_ENV || 'dev'

/**
 *
 * @param message
 * @param title
 * @param cName
 */
const printer: PrinterFunction = (message, title, cName) => {
    if (NODE_ENV !== 'test') {
        cName = cName ?? 'bgRed'
        if (title.length) console.log(color[cName](`${title}`))
        console.log(color.yellow(Array.isArray(message) ? message.join('\n') : message))
        console.log(``)
    }
}

export { printer }
