class Queue {
    constructor(logger, concurrencyLimit = 15, timeout = 20000) {
        this.queue = new Map()
        this.queueTime = new Map()
        this.idsCallbacks = new Map()
        this.workingOnPromise = new Map()
        this.logger = logger
        this.timeout = timeout
        this.concurrencyLimit = concurrencyLimit
    }

    /**
     * Encola el proceso
     * @param {*} from
     * @param {*} promiseFunc
     * @returns
     */
    async enqueue(from, promiseFunc, fingerIdRef) {
        this.logger.log(`${from}:ENCOLADO ${fingerIdRef}`)

        if (!this.queue.has(from)) {
            this.queue.set(from, [])
            this.workingOnPromise.set(from, false)
        }

        const queueByFrom = this.queue.get(from)
        const workingByFrom = this.workingOnPromise.get(from)

        return new Promise((resolve, reject) => {
            queueByFrom.push({
                promiseFunc,
                fingerIdRef,
                cancelled: false,
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

        const timeOutFn = (item) => {
            return new Promise((_, reject) => {
                if (item.cancelled) {
                    reject('cancelled')
                }

                // const fingerTimeByFrom = this.queueTime.get(from)
                // if (fingerTimeByFrom > item.fingerTime) {
                //     console.log(`🚀🚀 ${fingerTimeByFrom}------${item.fingerTime}`)
                //     reject('overtime')
                // }

                setTimeout(() => reject('timeout'), this.timeout)
            })
        }

        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit)

            const promises = tasksToProcess.map(async (item) => {
                try {
                    const value = await Promise.race([timeOutFn(item), item.promiseFunc()])
                    item.resolve(value)
                    this.logger.log(`${from}:SUCCESS`)
                } catch (err) {
                    this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`)
                    item.reject(err)
                }
                this.clearIdFromCallback(from, item.fingerIdRef)
            })

            await Promise.allSettled(promises)
        }

        this.workingOnPromise.set(from, false)
        await this.clearQueue(from)
    }

    /**
     * Limpia la cola de procesos
     * @param {*} from
     */
    async clearQueue(from) {
        if (this.queue.has(from)) {
            const queueByFrom = this.queue.get(from)
            const workingByFrom = this.workingOnPromise.get(from)

            // Marca todas las promesas como canceladas
            queueByFrom.forEach((item) => {
                item.cancelled = true
                item.reject('Queue cleared')
            })

            // Limpia la cola

            this.queue.set(from, [])

            // Si hay un proceso en ejecución, también deberías cancelarlo
            if (workingByFrom) {
                this.workingOnPromise.set(from, false)
            }
        }
    }

    /**
     * Establecer una marca de tiempo de ejecuccion de promeses
     * esto evita resolver promesas que yo no necesita
     * @param {*} from
     * @param {*} fingerTime
     */
    setFingerTime = (from, fingerTime) => {
        this.queueTime.set(from, fingerTime)
    }

    setIdsCallbacks = (from, ids = []) => {
        this.idsCallbacks.set(from, ids)
    }

    getIdsCallbacs = (from) => {
        if (this.idsCallbacks.has(from)) {
            return this.idsCallbacks.get(from)
        } else {
            return []
        }
    }

    clearIdFromCallback = (from, id) => {
        if (this.idsCallbacks.has(from)) {
            const ids = this.idsCallbacks.get(from)
            const index = ids.indexOf(id)

            if (index !== -1) {
                ids.splice(index, 1)
            }
        }
    }
}

module.exports = Queue
