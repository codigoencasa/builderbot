const { toSerialize } = require('./methods')

class FlowClass {
    allContexts = []
    allCallbacks = []
    flowSerialize = []
    flowRaw = []
    constructor(_flow) {
        if (!Array.isArray(_flow)) throw new Error('Esto debe ser un ARRAY')
        _flow.forEach((ctxFlow, parentIndex) => {
            const callbacks = ctxFlow.ctx?.callbacks || []
            const contexts = ctxFlow.ctx?.contexts || []

            callbacks.forEach((deepCallbacks) => {
                if (deepCallbacks && contexts[parentIndex]) {
                    const ctxChild = contexts[parentIndex]
                    deepCallbacks.callback(null, ctxChild)
                }
            })
        })

        this.flowRaw = _flow
        this.allContexts = _flow
            .map((ctxs) => ctxs.ctx.contexts)
            .flat(2)
            .map((c, i) => ({ getCtx: c?.getCtx, index: i }))

        this.allCallbacks = _flow
            .map((cbIn) => cbIn.ctx.callbacks)
            .flat(2)
            .map((c, i) => ({ callback: c?.callback, index: i }))

        const mergeToJsonSerialize = Object.keys(_flow)
            .map((indexObjectFlow) => _flow[indexObjectFlow].toJson())
            .flat(2)

        this.flowSerialize = toSerialize(mergeToJsonSerialize)
    }

    find = (keyOrWord, symbol = false) => {
        let capture = false
        let messages = []
        let refSymbol = null

        const findIn = (
            keyOrWord,
            symbol = false,
            flow = this.flowSerialize
        ) => {
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
