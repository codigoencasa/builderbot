const { EventEmitter } = require('node:events')

class IdleState extends EventEmitter {
    timer = null
    startTime = 0
    endTime = 0

    setIdleTime = (timeInSeconds) => {
        this.startTime = timeInSeconds
        return this.reset()
    }

    startTimer = () => {
        this.timer = setInterval(() => {
            const currentTime = new Date().getTime()

            if (currentTime > this.endTime) {
                this.stop()
                this.emit('idle')
            } else {
                this.debugTime()
            }
        }, 1000)
    }

    start = () => {
        if (!this.timer) {
            this.reset()
            this.startTimer()
        }
    }

    reset = () => {
        const currentTime = new Date().getTime()
        this.endTime = currentTime + this.startTime * 1000
    }

    stop = () => {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    debugTime = () => {
        const currentTime = new Date().getTime()
        return `Tiempo restante: ${((this.endTime - currentTime) / 1000).toFixed(0)} segundos`
    }
}

module.exports = IdleState
