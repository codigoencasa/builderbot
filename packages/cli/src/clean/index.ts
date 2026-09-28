/**
 * LAYER: Interface
 * Contains: PathString, CleanSessionFunction
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(n) score:3
 * keywords: [PathString, CleanSessionFunction]
 * GOAL: Own the "clean" concern of the cli package.
 */
import { join } from 'path'
import color from 'picocolors'
import { rimraf } from 'rimraf'

export type PathString = string

const PATH_WW: PathString[] = [join(process.cwd(), '.wwebjs_auth'), join(process.cwd(), 'session.json')]

export type CleanSessionFunction = () => Promise<boolean[]>

const cleanSession: CleanSessionFunction = () => {
    const queue: Promise<boolean>[] = []
    for (const PATH of PATH_WW) {
        console.log(color.yellow(`😬 Eliminando: ${PATH}`))
        queue.push(rimraf(PATH, { maxRetries: 2 }))
    }
    return Promise.all(queue)
}

export { cleanSession }
