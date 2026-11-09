/**
 * LAYER: Interface
 * Contains: printer — colored console output
 * Rules: Presentation only. No business rules.
 * BigO: O(1) score:5
 * keywords: [printer]
 * GOAL: Render formatted messages to the console for operators.
 */
import color from 'picocolors'

type PrinterFunction = (message: string | string[], title: string, cName?: 'bgMagenta' | 'bgRed' | 'bgCyan') => void

/**
 *
 * @param message
 * @param title
 * @param cName
 */
const printer: PrinterFunction = (message, title, cName) => {
    const NODE_ENV: string = process.env.NODE_ENV || 'dev'

    const SILENT: string = process.env.BUILDERBOT_SILENT || 'false'

    // 👉 Solo imprime si no está silenciado y no estás en test
    if (SILENT === 'true' || NODE_ENV === 'test') return

    cName = cName ?? 'bgRed'
    if (title.length) console.log(color[cName](`${title}`))
    console.log(color.yellow(Array.isArray(message) ? message.join('\n') : message))
    console.log(``)
}

export { printer }
