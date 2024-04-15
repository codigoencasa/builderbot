type Logger = Console

interface QueueItem<T> {
    promiseFunc: (item: QueueItem<T>) => PromiseFunctionWrapper<T>
    fingerIdRef: string
    cancelled: boolean
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
}

interface PromiseFunctionWrapper<T> {
    promiseInFunc: () => Promise<T>
    timer: (item: { resolve: (value: T | PromiseLike<T>) => void }) => NodeJS.Timeout
    timerPromise: Promise<T>
    cancel: () => void
}

class Queue<T> {
    private queue: Map<string, QueueItem<T>[]>
    private timers: Map<string, NodeJS.Timeout | boolean>
    private idsCallbacks: Map<string, string[]>
    private workingOnPromise: Map<string, boolean>
    private logger: Logger
    private timeout: number
    private concurrencyLimit: number

    constructor(logger: Logger, concurrencyLimit = 15, timeout = 50000) {
        this.queue = new Map()
        this.timers = new Map()
        this.idsCallbacks = new Map()
        this.workingOnPromise = new Map()
        this.logger = logger
        this.timeout = timeout
        this.concurrencyLimit = concurrencyLimit < 1 ? 15 : concurrencyLimit
    }

    /**
     * Limpiar colar de proceso
     * @param from
     * @param item
     */
    public clearAndDone(from: string, item: { fingerIdRef: string }) {
        this.clearIdFromCallback(from, item.fingerIdRef)
        this.logger.log(`${from}: SUCCESS: ${item.fingerIdRef}`)
    }

    private async processItem(from: string, item: QueueItem<T>): Promise<void> {
        try {
            const refToPromise = item.promiseFunc(item)
            const value = await Promise.race([
                refToPromise.timerPromise,
                refToPromise.promiseInFunc().then(() => {
                    refToPromise.cancel()
                    return 'success' as unknown as T // Assuming 'success' is a valid T
                }),
            ])
            item.resolve(value)
        } catch (err) {
            this.clearIdFromCallback(from, item.fingerIdRef)
            this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`)
            item.reject(err)
        }
    }

    async enqueue(from: string, promiseInFunc: () => Promise<T>, fingerIdRef: string): Promise<T> {
        this.logger.log(`${from}: QUEUE: ${fingerIdRef}`)

        if (!this.timers.has(fingerIdRef)) {
            this.timers.set(fingerIdRef, false)
        }

        if (!this.queue.has(from)) {
            this.queue.set(from, [])
            this.workingOnPromise.set(from, false)
        }

        const queueByFrom = this.queue.get(from)!
        const workingByFrom = this.workingOnPromise.get(from)!

        /**
         *
         * @param item
         * @returns
         */
        const promiseFunc = (item: QueueItem<T>): PromiseFunctionWrapper<T> => {
            type ITimerPromise = {
                resolve: (value: T | PromiseLike<T>) => void
                reject: (value: T | PromiseLike<T>) => void
            }

            const timer = ({ resolve }: ITimerPromise) =>
                setTimeout(() => {
                    console.log('no debe aparecer si la otra funcion del race se ejecuta primero 🙉🙉🙉🙉', fingerIdRef)
                    resolve('timeout' as unknown as T)
                }, this.timeout)

            const timerPromise = new Promise<T>((resolve, reject) => {
                if (item.cancelled) {
                    reject('cancelled')
                }
                if (!this.timers.has(fingerIdRef)) {
                    const refIdTimeOut = timer({ reject, resolve })
                    clearTimeout(this.timers.get(fingerIdRef) as NodeJS.Timeout)
                    this.timers.set(fingerIdRef, refIdTimeOut)
                    this.clearAndDone(from, item)
                    this.clearQueue(from)
                    return refIdTimeOut
                }

                return this.timers.get(fingerIdRef) as unknown as Promise<T>
            })

            const cancel = () => {
                clearTimeout(this.timers.get(fingerIdRef) as NodeJS.Timeout)
                this.timers.delete(fingerIdRef)
                this.clearAndDone(from, item)
            }
            return { promiseInFunc, timer, timerPromise, cancel }
        }

        return new Promise<T>((resolve, reject) => {
            const pid = queueByFrom.findIndex((i) => i.fingerIdRef === fingerIdRef)
            if (pid !== -1) {
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
                this.logger.log(`${from}: EXECUTING: ${fingerIdRef}`)
                this.processQueue(from)
                this.workingOnPromise.set(from, true)
            }
        })
    }

    async processQueue(from: string): Promise<void> {
        const queueByFrom = this.queue.get(from)!
        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit - 1)
            const promises = tasksToProcess.map((item) =>
                this.processItem(from, item).finally(() => this.clearAndDone(from, item))
            )
            await Promise.all(promises)
        }

        this.workingOnPromise.set(from, false)
        await this.clearQueue(from)
    }

    async clearQueue(from: string): Promise<number> {
        if (this.queue.has(from)) {
            const queueByFrom = this.queue.get(from)!
            const workingByFrom = this.workingOnPromise.get(from)!

            try {
                for (const item of queueByFrom) {
                    item.cancelled = true
                    this.clearAndDone(from, item)
                    item.resolve('Queue cleared' as unknown as T)
                }
            } finally {
                this.queue.set(from, [])
                this.idsCallbacks.set(from, [])
            }

            if (workingByFrom) {
                this.workingOnPromise.set(from, false)
            }
            const queueNumber = queueByFrom.length
            return Promise.resolve(queueNumber)
        }
    }

    setIdsCallbacks(from: string, ids: string[] = []): void {
        this.idsCallbacks.set(from, ids)
    }

    getIdsCallback(from: string): string[] {
        return this.idsCallbacks.get(from) || []
    }

    getIdWithFrom(from: string, id: string): number {
        const ids = this.idsCallbacks.get(from) || []
        const index = ids.indexOf(id)
        return index
    }

    clearIdFromCallback(from: string, id: string): void {
        if (this.idsCallbacks.has(from)) {
            const ids = this.idsCallbacks.get(from)!
            const index = ids.indexOf(id)

            if (index !== -1) {
                ids.splice(index, 1)
            }
        }
    }
}

export { Queue }
