const { toSerialize } = require('./methods/toSerialize')

class FlowClass {
    allCallbacks = []
    flowSerialize = []
    flowRaw = []
    constructor(_flow) {
        if (!Array.isArray(_flow)) throw new Error('Esto debe ser un ARRAY')
        this.flowRaw = _flow

        this.allCallbacks = _flow
            .map((cbIn) => cbIn.ctx.callbacks)
            .flat(2)
            .map((c, i) => ({ callback: c?.callback, index: i }))

        const mergeToJsonSerialize = Object.keys(_flow)
            .map((indexObjectFlow) => _flow[indexObjectFlow].toJson())
            .flat(2)

        this.flowSerialize = toSerialize(mergeToJsonSerialize)
    }

    find = (keyOrWord, symbol = false, overFlow = null) => {
        let capture = false
        let messages = []
        let refSymbol = null
        overFlow = overFlow ?? this.flowSerialize

        const findIn = (keyOrWord, symbol = false, flow = overFlow) => {
            capture = refSymbol?.options?.capture || false
            if (capture) return messages

            if (symbol) {
                refSymbol = flow.find((c) => c.keyword === keyOrWord)
                if (refSymbol?.answer) messages.push(refSymbol)
                if (refSymbol?.ref) findIn(refSymbol.ref, true)
            } else {
                refSymbol = flow.find((c) => c.keyword.includes(keyOrWord))
                if (refSymbol?.ref) findIn(refSymbol.ref, true)
                return messages
            }
        }
        findIn(keyOrWord, symbol)
        return messages
    }

    findBySerialize = (refSerialize) =>
        this.flowSerialize.find((r) => r.refSerialize === refSerialize)

    findIndexByRef = (ref) => this.flowSerialize.findIndex((r) => r.ref === ref)
}

module.exports = FlowClass
