/**
 * LAYER: Domain
 * Contains: Queue — async FIFO task queue
 * Rules: No external dependencies. Pure concurrency orchestration.
 * BigO: O(n^2) score:1
 * keywords: [Queue, CoreClass]
 * GOAL: Serialize asynchronous tasks so the runtime processes them in order. Nested loops follow bounded queue operations.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

type Logger = Console

/**
 * Señal de cancelación cooperativa que recibe el trabajo de un item de la cola.
 * Se marca `cancelled = true` cuando el item excede el timeout (o la cola se limpia),
 * para que el trabajo pueda abortar antes de continuar su cadena (p. ej. evitar ejecutar
 * el callback del flujo o reenviar tras un timeout).
 */
interface QueueTaskSignal {
    readonly cancelled: boolean
}

interface QueueItem<T> {
    promiseFunc: (item: QueueItem<T>) => PromiseFunctionWrapper<T>
    fingerIdRef: string
    cancelled: boolean
    /**
     * true si el item fue encolado desde dentro de la ejecución de otro item del mismo
     * `from` (re-entrada: continuación que desbloquea a su padre). Los items re-entrantes
     * pueden arrancar aunque se haya alcanzado `concurrencyLimit`, porque su padre está
     * bloqueado esperándolos (no consumen trabajo independiente real).
     */
    reentrant: boolean
    /** Timeout específico del item; si es undefined se usa el timeout global de la cola. */
    timeout?: number
    resolve: (value: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
}

interface PromiseFunctionWrapper<T> {
    promiseInFunc: (signal: QueueTaskSignal) => Promise<T>
    timer: (item: { resolve: (value: T | PromiseLike<T>) => void }) => NodeJS.Timeout
    timerPromise: Promise<T>
    cancel: () => void
}

class Queue<T> {
    private queue: Map<string, QueueItem<T>[]>
    private timers: Map<string, NodeJS.Timeout | boolean>
    private idsCallbacks: Map<string, string[]>
    private workingOnPromise: Map<string, boolean>
    private wakeups: Map<string, () => void>
    /** Contexto async para detectar enqueues re-entrantes del mismo `from`. */
    private readonly als: AsyncLocalStorage<string>
    private logger: Logger
    private timeout: number
    private concurrencyLimit: number

    constructor(logger: Logger, concurrencyLimit = 15, timeout = 50000) {
        this.queue = new Map()
        this.timers = new Map()
        this.idsCallbacks = new Map()
        this.workingOnPromise = new Map()
        this.wakeups = new Map()
        this.als = new AsyncLocalStorage()
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

    /**
     * Clave compuesta para los timers. Aislar por `from` evita que un item de un usuario
     * cancele el timer de otro (antes `timers` estaba keyado solo por `fingerIdRef`).
     */
    private timerKey(from: string, fingerIdRef: string): string {
        return `${from}::${fingerIdRef}`
    }

    /**
     * Despierta al drenador (pump) de un `from` si está esperando por nuevos items.
     * Se llama al encolar un item nuevo y al completar un item en vuelo, para que el pump
     * reevalúe la cola sin quedarse bloqueado esperando a que termine un item que, a su vez,
     * depende de un item recién encolado (auto-deadlock re-entrante).
     */
    private notifyQueue(from: string): void {
        const wake = this.wakeups.get(from)
        if (wake) {
            this.wakeups.delete(from)
            wake()
        }
    }

    private async processItem(from: string, item: QueueItem<T>): Promise<void> {
        try {
            const refToPromise = item.promiseFunc(item)
            const signal: QueueTaskSignal = {
                get cancelled() {
                    return item.cancelled
                },
            }
            const value = await Promise.race([
                refToPromise.timerPromise,
                // Ejecutar el trabajo dentro del contexto `from`: cualquier `enqueue` que
                // ocurra en su cadena async se marcará como re-entrante.
                this.als.run(from, () =>
                    refToPromise.promiseInFunc(signal).then(() => {
                        refToPromise.cancel()
                        return 'success' as unknown as T // Assuming 'success' is a valid T
                    })
                ),
            ])
            item.resolve(value)
        } catch (err) {
            this.clearIdFromCallback(from, item.fingerIdRef)
            this.logger.error(`${from}:ERROR: ${JSON.stringify(err)}`)
            item.reject(err)
        }
    }

    async enqueue(
        from: string,
        promiseInFunc: (signal: QueueTaskSignal) => Promise<T>,
        fingerIdRef: string,
        timeout?: number
    ): Promise<T> {
        this.logger.log(`${from}: QUEUE: ${fingerIdRef}`)

        const timerKey = this.timerKey(from, fingerIdRef)
        if (!this.timers.has(timerKey)) {
            this.timers.set(timerKey, false)
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

            // Modo seguro por defecto: no limpia la cola al crear el timeout y gestiona timers por item
            const itemTimeout = item.timeout ?? this.timeout
            const timer = ({ reject }: ITimerPromise) =>
                setTimeout(() => {
                    // Cancelación cooperativa: que el trabajo en curso pueda abortar su cadena
                    item.cancelled = true
                    reject(new Error(`Queue item timeout after ${itemTimeout}ms`) as unknown as T)
                }, itemTimeout)

            const timerPromise = new Promise<T>((resolve, reject) => {
                if (item.cancelled) return reject('cancelled' as unknown as any)
                const existing = this.timers.get(timerKey)
                if (existing && typeof existing !== 'boolean') clearTimeout(existing as NodeJS.Timeout)
                const refIdTimeOut = timer({ reject, resolve })
                this.timers.set(timerKey, refIdTimeOut)
            })

            // `clearAndDone` se invoca en el `.finally` de `processQueue`; no duplicar aquí.
            const cancel = () => {
                const t = this.timers.get(timerKey)
                if (t && typeof t !== 'boolean') clearTimeout(t as NodeJS.Timeout)
                this.timers.delete(timerKey)
            }
            return { promiseInFunc, timer, timerPromise, cancel }
        }

        return new Promise<T>((resolve, reject) => {
            const pid = queueByFrom.findIndex((i) => i.fingerIdRef === fingerIdRef)
            if (pid !== -1) {
                // Ignorar silenciosamente duplicados del mismo ID y resolver en éxito
                this.logger.log(`${from}: DUPLICATE: ${fingerIdRef} (ignored)`)
                return resolve('success' as unknown as T)
            }

            queueByFrom.push({
                promiseFunc,
                fingerIdRef,
                cancelled: false,
                reentrant: this.als.getStore() === from,
                timeout,
                resolve,
                reject,
            })

            // Si ya hay un drenador activo esperando, despertarlo para que tome este item.
            // Sin esto, un item encolado re-entrantemente queda huérfano hasta el timeout.
            this.notifyQueue(from)

            if (!workingByFrom) {
                this.logger.log(`${from}: EXECUTING: ${fingerIdRef}`)
                this.processQueue(from)
                this.workingOnPromise.set(from, true)
            }
        })
    }

    async processQueue(from: string): Promise<void> {
        const queueByFrom = this.queue.get(from)!
        /**
         * Ventana deslizante (worker-pool por `from`).
         *
         * Reemplaza el drenado por lotes bloqueantes (`splice` + `await Promise.all(batch)`),
         * que producía un auto-deadlock cuando el trabajo de un item encolaba y awaitaba
         * otro item del mismo `from` (cadena: cbEveryCtx -> callback del flujo ->
         * continueFlow/gotoFlow -> sendFlow -> enqueueMsg): el item nuevo quedaba en la cola
         * mientras el loop esperaba al batch que contenía al item padre.
         *
         * Con la ventana deslizante, cada vez que se libera un slot se toma el siguiente item
         * FIFO, por lo que un item encolado re-entrantemente arranca sin esperar al cierre del
         * batch. Se preservan FIFO en el arranque y el límite de concurrencia.
         *
         * Limitación conocida: si los `concurrencyLimit` slots están ocupados por items que
         * todos awaitan items encolados, el deadlock teórico persiste; el timeout de la cola
         * sigue actuando como red de seguridad.
         */
        const inFlight = new Set<Promise<void>>()

        while (queueByFrom.length > 0 || inFlight.size > 0) {
            // Llenar slots. Con capacidad: FIFO estricto. Al límite: solo items re-entrantes,
            // porque son continuaciones que desbloquean a un padre en vuelo (si no, deadlock).
            while (queueByFrom.length > 0) {
                const hasCapacity = inFlight.size < this.concurrencyLimit
                const idx = hasCapacity ? 0 : queueByFrom.findIndex((i) => i.reentrant)
                if (idx === -1) break
                const item = queueByFrom.splice(idx, 1)[0]
                const inFlightPromise: Promise<void> = this.processItem(from, item).finally(() => {
                    this.clearAndDone(from, item)
                    inFlight.delete(inFlightPromise)
                    this.notifyQueue(from)
                })
                inFlight.add(inFlightPromise)
            }

            // Esperar a que se libere un slot o llegue un item nuevo. `processItem` nunca
            // rechaza (captura todo internamente y llama a item.reject). No hay `await`
            // entre el chequeo `inFlight.size > 0` y el registro del wakeup, así que no se
            // pierde ninguna notificación en esa ventana.
            if (inFlight.size > 0) {
                await new Promise<void>((resolve) => this.wakeups.set(from, resolve))
            }
        }

        // No hay `await` entre el último chequeo de cola vacía y este set: atómico en JS
        this.workingOnPromise.set(from, false)
        await this.clearQueue(from)
    }

    /**
     * Limpia todas las colas (todos los `from`). Pensado para shutdown.
     */
    async clearAll(): Promise<void> {
        for (const from of Array.from(this.queue.keys())) {
            await this.clearQueue(from)
        }
    }

    async clearQueue(from: string): Promise<number> {
        if (this.queue.has(from)) {
            const queueByFrom = this.queue.get(from)!
            const workingByFrom = this.workingOnPromise.get(from)!

            try {
                for (const item of queueByFrom) {
                    item.cancelled = true
                    this.clearAndDone(from, item)
                    // Resolver silenciosamente las tareas pendientes al limpiar la cola
                    item.resolve('success' as unknown as T)
                }
            } finally {
                this.queue.set(from, [])
                this.idsCallbacks.set(from, [])
                // Limpiar solo los timers de este `from` (no los de items en vuelo de otros)
                const timerPrefix = `${from}::`
                this.timers.forEach((timer, key) => {
                    if (!key.startsWith(timerPrefix)) return
                    if (timer !== false) {
                        clearTimeout(timer as NodeJS.Timeout)
                    }
                    this.timers.delete(key)
                })
            }

            if (workingByFrom) {
                this.workingOnPromise.set(from, false)
            }
            // Después de limpiar, no quedan elementos en cola.
            return 0
        }
        return 0
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
export type { QueueTaskSignal }
