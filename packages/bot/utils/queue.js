class Queue {
    constructor(logger) {
        this.queue = []
        this.workingOnPromise = false
        this.logger = logger
    }

    enqueue(promiseFunc) {
        this.logger.log(`QUEUE: Enqueued`)
        return new Promise((resolve, reject) => {
            this.queue.push({
                promiseFunc,
                resolve,
                reject,
            })

            if (!this.workingOnPromise) {
                this.dequeue()
            }
        })
    }

    async dequeue() {
        if (this.workingOnPromise || this.queue.length === 0) {
            this.logger.log(`QUEUE: workingOnPromise:${this.workingOnPromise}, queue_length:${this.queue.length}`)
            return
        }

        this.workingOnPromise = true

        try {
            while (this.queue.length > 0) {
                const item = this.queue.shift()

                try {
                    const value = await item.promiseFunc()
                    item.resolve(value)
                } catch (err) {
                    this.logger.error(`Error en cola: ${err.message}`)
                    item.reject(err)
                }
            }
        } finally {
            this.workingOnPromise = false
            // Verifica si hay tareas pendientes y desencola si es necesario
            if (this.queue.length > 0) {
                this.dequeue()
            }
        }
    }
}

module.exports = Queue
