class Queue {
    constructor(logger) {
        this.queue = []
        this.workingOnPromise = false
        this.logger = logger
    }

    async enqueue(promise) {
        this.logger.log(`QUEUE: Encolado`)
        return new Promise((resolve, reject) => {
            this.queue.push({
                promise,
                resolve,
                reject,
            })
            this.dequeue()
        })
    }

    async dequeue() {
        if (this.workingOnPromise || this.queue.length === 0) {
            this.logger.log(`QUEUE: workingOnPromise:${this.workingOnPromise}, queue_length:${this.queue.length}`)
            return
        }

        this.workingOnPromise = true

        while (this.queue.length > 0) {
            const item = this.queue.shift()

            try {
                const value = await item.promise()
                item.resolve(value)
            } catch (err) {
                this.logger.error(`Error en cola: ${err.message}`)
                item.reject(err)
            }
        }

        this.workingOnPromise = false
    }
}

module.exports = Queue
