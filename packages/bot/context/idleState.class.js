class IdleState {
    indexCb = new Map()

    setIdleTime = ({ from, inRef, timeInSeconds, cb }) => {
        const startTime = new Date().getTime()
        const endTime = startTime + timeInSeconds * 1000

        if (!this.indexCb.has(from)) this.indexCb.set(from, [])
        const queueCb = this.indexCb.get(from)

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
            stop: (ctxInComming) => {
                clearInterval(interval)
                cb({ ...ctxInComming, next: false, inRef })
            },
        })
    }

    stop = (ctxInComming) => {
        try {
            const queueCb = this.indexCb.get(ctxInComming.from) ?? []
            for (const iterator of queueCb) {
                iterator.stop(ctxInComming)
            }
        } catch (err) {
            console.log(err)
            return null
        }
    }
}

module.exports = IdleState
