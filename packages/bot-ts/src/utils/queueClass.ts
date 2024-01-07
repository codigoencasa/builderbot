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
    private queueTime: Map<string, number>
    private timers: Map<string, NodeJS.Timeout | boolean>
    private idsCallbacks: Map<string, string[]>
    private workingOnPromise: Map<string, boolean>
    private logger: Logger
    private timeout: number
    private concurrencyLimit: number

    constructor(logger: Logger, concurrencyLimit = 15, timeout = 50000) {
        this.queue = new Map()
        this.queueTime = new Map()
        this.timers = new Map()
        this.idsCallbacks = new Map()
        this.workingOnPromise = new Map()
        this.logger = logger
        this.timeout = timeout
        this.concurrencyLimit = concurrencyLimit
    }

    async enqueue(from: string, promiseInFunc: () => Promise<T>, fingerIdRef: string): Promise<T> {
        this.logger.log(`${from}:ENCOLADO ${fingerIdRef}`)

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
                    this.clearQueue(from)
                    return refIdTimeOut
                }

                return this.timers.get(fingerIdRef) as unknown as Promise<T>
            })

            const cancel = () => {
                clearTimeout(this.timers.get(fingerIdRef) as NodeJS.Timeout)
                this.timers.delete(fingerIdRef)
            }
            return { promiseInFunc, timer, timerPromise, cancel }
        }

        return new Promise<T>((resolve, reject) => {
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

    async processQueue(from: string): Promise<void> {
        const queueByFrom = this.queue.get(from)!

        while (queueByFrom.length > 0) {
            const tasksToProcess = queueByFrom.splice(0, this.concurrencyLimit)

            const promises = tasksToProcess.map(async (item) => {
                try {
                    const refToPromise = item.promiseFunc(item)
                    const value = await Promise.race([
                        refToPromise.timerPromise,
                        refToPromise.promiseInFunc().then(() => {
                            refToPromise.cancel()
                            return 'success' as unknown as T // Assuming 'success' is a valid T
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

    async clearQueue(from: string): Promise<void> {
        if (this.queue.has(from)) {
            const queueByFrom = this.queue.get(from)!
            const workingByFrom = this.workingOnPromise.get(from)!

            try {
                for (const item of queueByFrom) {
                    item.cancelled = true
                    item.resolve('Queue cleared' as unknown as T)
                }
            } finally {
                this.queue.set(from, [])
            }

            if (workingByFrom) {
                this.workingOnPromise.set(from, false)
            }
        }
    }

    setFingerTime(from: string, fingerTime: number): void {
        this.queueTime.set(from, fingerTime)
    }

    setIdsCallbacks(from: string, ids: string[] = []): void {
        this.idsCallbacks.set(from, ids)
    }

    getIdsCallback(from: string): string[] {
        return this.idsCallbacks.get(from) || []
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
