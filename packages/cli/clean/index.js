const rimraf = require('rimraf')
const { yellow } = require('kleur')
const { join } = require('path')

const PATH_WW = [join(process.cwd(), '.wwebjs_auth'), join(process.cwd(), 'session.json')]

const cleanSession = () => {
    const queue = []
    for (const PATH of PATH_WW) {
        console.log(yellow(`😬 Eliminando: ${PATH}`))
        queue.push(rimraf(PATH, () => Promise.resolve()))
    }
    return Promise.all(queue)
}

module.exports = { cleanSession }
