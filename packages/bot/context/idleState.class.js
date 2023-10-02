class IdleState {
    index = new Map()
    indexInterval = new Map()
    indexEnd = new Map()

    setIdleTime = (inRef, timeInSeconds) => {
        this.stop(inRef)
        const currentTime = new Date().getTime()
        const endTime = currentTime + timeInSeconds * 1000
        if (!this.index.has(inRef)) this.index.set(inRef, timeInSeconds)
        if (!this.indexInterval.has(inRef)) this.indexInterval.set(inRef, null)
        if (!this.indexEnd.has(inRef)) this.indexEnd.set(inRef, endTime)
    }

    start = (inRef, cb = () => null) => {
        const refTimer = this.index.get(inRef) ?? undefined
        if (refTimer) {
            const interval = setInterval(() => {
                const currentTime = new Date().getTime()
                const endTime = this.indexEnd.get(inRef)
                if (currentTime > endTime) {
                    this.stop(inRef)
                    cb()
                }
            }, 1000)

            this.indexInterval.set(inRef, interval)
        }
    }

    stop = (inRef) => {
        try {
            clearInterval(this.indexInterval.get(inRef))
            this.index.delete(inRef)
            this.indexInterval.delete(inRef)
            this.indexEnd.delete(inRef)
        } catch (err) {
            return null
        }
    }
}

module.exports = IdleState
