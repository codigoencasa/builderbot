class Queue {
    constructor(logger, concurrencyLimit = 1) {
        this.queue = new Map()
        this.workingOnPromise = new Map()
        this.logger = logger
        this.concurrencyLimit = concurrencyLimit
    }

    async enqueue(from, promiseFunc) {
        this.logger.log(`QUEUE: Enqueued ${from}`)

        if (!this.queue.has(from)) {
            this.queue.set(from, [])
            this.workingOnPromise.set(from, false)
        }

        const queueByFrom = this.queue.get(from)
        const workingByFrom = this.workingOnPromise.get(from)

        return new Promise((resolve, reject) => {
            queueByFrom.push({
                promiseFunc,
                resolve,
                reject,
            })

            if (!workingByFrom) {
                this.workingOnPromise.set(from, true)
                this.processQueue(from)
            }
        })
    }

    async processQueue(from) {
        const queueByFrom = this.queue.get(from)

        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit)

            await Promise.allSettled(
                tasksToProcess.map(async (item) => {
                    try {
                        const value = await item.promiseFunc()
                        item.resolve(value)
                    } catch (err) {
                        this.logger.error(`Error en cola: ${err.message}`)
                        item.reject(err)
                    }
                })
            )
        }

        this.workingOnPromise.set(from, false)
    }

    async clearQueue(from) {
        if (this.queue.has(from)) {
            this.queue.set(from, [])
            const workingByFrom = this.workingOnPromise.get(from)

            if (workingByFrom) {
                this.workingOnPromise.set(from, false)
            }
        }
    }
}

module.exports = Queue
