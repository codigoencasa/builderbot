const Queue = require('queue-promise')
const { Console } = require('console')
const { createWriteStream } = require('fs')
const logger = new Console({
    stdout: createWriteStream(`${process.cwd()}/queue.class.log`),
})

const queue = new Queue({
    concurrent: 2,
    interval: 0,
})

queue.on('start', () => logger.log('[Queue]:Start'))
queue.on('stop', () => logger.log('[Queue]:Stop'))
queue.on('end', () => logger.log('[Queue]:End'))

queue.on('reject', (error) => logger.log(`[ERROR:QUEUE]:`, error))

module.exports = queue
