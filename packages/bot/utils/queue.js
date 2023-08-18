class Queue {
    constructor(logger, concurrencyLimit = 15) {
        this.queue = new Map()
        this.workingOnPromise = new Map()
        this.logger = logger
        this.concurrencyLimit = concurrencyLimit
    }

    /**
     * Encola el proceso
     * @param {*} from
     * @param {*} promiseFunc
     * @returns
     */
    async enqueue(from, promiseFunc) {
        this.logger.log(`${from}:ENCOLADO`)

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
                this.logger.log(`${from}:EJECUTANDO`)
                this.workingOnPromise.set(from, true)
                this.processQueue(from)
            }
        })
    }

    /**
     * Ejecuta el proceso encolado
     * @param {*} from
     */
    async processQueue(from) {
        const queueByFrom = this.queue.get(from)

        const promise1 = () => new Promise((_, reject) => setTimeout(() => reject('timeout'), 20000))

        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit)

            const promises = tasksToProcess.map(async (item) => {
                try {
                    const value = await Promise.race([promise1(), item.promiseFunc()])
                    item.resolve(value)
                    this.logger.log(`${from}:SUCCESS`)
                } catch (err) {
                    this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`)
                    item.reject(err)
                }
            })

            await Promise.allSettled(promises)
        }

        this.workingOnPromise.set(from, false)
    }

    /**
     * Limpia la cola de procesos
     * @param {*} from
     */
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
