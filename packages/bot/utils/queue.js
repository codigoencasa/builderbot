class Queue {
    queue = []
    workingOnPromise = false

    enqueue(promiseFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                promiseFn,
                resolve,
                reject,
            })
            this.dequeue()
        })
    }

    dequeue() {
        if (this.workingOnPromise) {
            return false
        }
        const item = this.queue.shift()
        if (!item) {
            return false
        }
        try {
            this.workingOnPromise = true
            item.promiseFn()
                .then((value) => {
                    this.workingOnPromise = false
                    item.resolve(value)
                    this.dequeue()
                })
                .catch((err) => {
                    this.workingOnPromise = false
                    item.reject(err)
                    this.dequeue()
                })
        } catch (err) {
            this.workingOnPromise = false
            item.reject(err)
            this.dequeue()
        }
        return true
    }
}

module.exports = Queue
