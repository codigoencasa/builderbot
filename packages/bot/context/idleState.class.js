const { EventEmitter } = require('node:events')

class IdleState extends EventEmitter {
    index = new Map()
    indexInterval = new Map()
    timer = null
    startTime = 0
    endTime = 0

    setIdleTime = (inRef, timeInSeconds) => {
        if (!this.index.has(inRef)) {
            this.index.set(inRef, timeInSeconds)
            this.indexInterval.set(inRef, null)
        }
    }

    startTimer = (inRef) => {
        const interval = setInterval(() => {
            const currentTime = new Date().getTime()
            if (currentTime > this.endTime) {
                this.stop(inRef)
                this.emit(`timeout_${inRef}`)
            }
        }, 1000)

        this.indexInterval.set(inRef, interval)
    }

    start = (inRef) => {
        const refTimer = this.index.get(inRef) ?? undefined
        if (refTimer) {
            this.startTimer(inRef)
        }
    }

    stop = (inRef) => {
        try {
            this.index.delete(inRef)
            clearInterval(this.indexInterval.get(inRef))
            this.indexInterval.delete(inRef)
        } catch (err) {
            return null
        }
    }
}

module.exports = IdleState
