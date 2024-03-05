type Callback = (context: { next: boolean; inRef: any }) => void

interface SetIdleTimeParams {
    from: string
    inRef: any
    timeInSeconds: number
    cb?: Callback
}

interface GetParams {
    from: string
    inRef: any
}

interface QueueItem {
    from: string
    inRef: any
    cb: Callback
    stop: (ctxInComing: any) => void
}

class IdleState {
    private indexCb: Map<string, QueueItem[]> = new Map()

    /**
     *
     * @param param0
     */
    setIdleTime = ({ from, inRef, timeInSeconds, cb }: SetIdleTimeParams): void => {
        cb = cb ?? (() => {})
        const startTime = new Date().getTime()
        const endTime = startTime + timeInSeconds * 1000

        if (!this.indexCb.has(from)) this.indexCb.set(from, [])
        const queueCb = this.indexCb.get(from)!

        const interval = setInterval(() => {
            const internalTime = new Date().getTime()
            if (internalTime > endTime) {
                cb({ next: true, inRef })
                const map = this.indexCb.get(from) ?? []
                const index = map.findIndex((o) => o.inRef === inRef)
                clearInterval(interval)
                map.splice(index, 1)
            }
        }, 1000)

        queueCb.push({
            from,
            inRef,
            cb,
            stop: (ctxInComing: any) => {
                clearInterval(interval)
                cb({ ...ctxInComing, next: false, inRef })
            },
        })
    }

    /**
     *
     * @param param0
     * @returns
     */
    get = ({ from, inRef }: GetParams): boolean | null => {
        try {
            const queueCb = this.indexCb.get(from) ?? []
            const isHas = queueCb.findIndex((i) => i.inRef !== inRef) !== -1
            return isHas
        } catch (err) {
            console.error(`Error Get ctxInComming: `, err)
            return null
        }
    }

    /**
     *
     * @param ctxInComing
     */
    stop = (ctxInComing: { from: any }): void => {
        try {
            const queueCb = this.indexCb.get(ctxInComing.from) ?? []
            for (const iterator of queueCb) {
                iterator.stop(ctxInComing)
            }
            this.indexCb.set(ctxInComing.from, [])
        } catch (err) {
            console.error(err)
        }
    }
}

export { IdleState }
