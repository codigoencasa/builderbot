class Queue {
    constructor(logger, concurrencyLimit = 15, timeout = 50000) {
        this.queue = new Map()
        this.queueTime = new Map()
        this.timers = new Map()
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
    async enqueue(from, promiseInFunc, fingerIdRef) {
        this.logger.log(`${from}:ENCOLADO ${fingerIdRef}`)

        if (!this.timers.has(fingerIdRef)) {
            this.timers.set(fingerIdRef, false)
        }

        if (!this.queue.has(from)) {
            this.queue.set(from, [])
            this.workingOnPromise.set(from, false)
        }

        const queueByFrom = this.queue.get(from)
        const workingByFrom = this.workingOnPromise.get(from)

        const promiseFunc = (item) => {
            const timer = ({ resolve }) =>
                setTimeout(() => {
                    console.log('no debe aparecer si la otra funcion del race se ejecuta primero 🙉🙉🙉🙉', fingerIdRef)
                    resolve('timeout')
                }, this.timeout)

            const timerPromise = new Promise((resolve, reject) => {
                if (item.cancelled) {
                    reject('cancelled')
                }
                if (!this.timers.has(fingerIdRef)) {
                    const refIdTimeOut = timer({ reject, resolve })
                    clearTimeout(this.timers.get(fingerIdRef))
                    this.timers.set(fingerIdRef, refIdTimeOut)
                    this.clearQueue(from)
                    return refIdTimeOut
                }

                return this.timers.get(fingerIdRef)
            })

            const cancel = () => {
                clearTimeout(this.timers.get(fingerIdRef))
                this.timers.delete(fingerIdRef)
            }
            return { promiseInFunc, timer, timerPromise, cancel }
        }

        return new Promise((resolve, reject) => {
            const pid = queueByFrom.findIndex((i) => i.fingerIdRef === fingerIdRef)
            if (pid !== -1) {
                console.log(`🔥🔥🔥🔥`)
                this.clearQueue(from)
            }

            queueByFrom.push({
                promiseFunc,
                fingerIdRef,
                cancelled: false,
                resolve,
                reject,
            })

            if (!workingByFrom) {
                this.logger.log(`EJECUTANDO:${fingerIdRef}`)
                this.processQueue(from)
                this.workingOnPromise.set(from, true)
            }
        })
    }

    /**
     * Ejecuta el proceso encolado
     * @param {*} from
     */
    async processQueue(from) {
        const queueByFrom = this.queue.get(from)

        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit)

            const promises = tasksToProcess.map(async (item) => {
                try {
                    const refToPromise = item.promiseFunc(item)
                    const value = await Promise.race([
                        refToPromise.timerPromise,
                        refToPromise.promiseInFunc().then(() => {
                            console.log('---', item.fingerIdRef)
                            return refToPromise.cancel()
                        }),
                    ])

                    this.clearIdFromCallback(from, item.fingerIdRef)
                    this.logger.log(`${from}:SUCCESS`)
                    return item.resolve(value)
                } catch (err) {
                    this.clearIdFromCallback(from, item.fingerIdRef)

                    this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`)
                    return item.reject(err)
                }
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

            try {
                for (const item of queueByFrom) {
                    item.cancelled = true
                    item.resolve('Queue cleared')
                }
            } finally {
                this.queue.set(from, [])
            }

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

    getIdsCallback = (from) => {
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
