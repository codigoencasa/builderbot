class FlowClass {
    flow
    constructor(_flow) {
        this.flow = _flow
    }

    find = (keyOrWord, symbol = false) => {
        let capture = false
        let messages = []
        let refSymbol

        const findIn = (keyOrWord, symbol = false, flow = this.flow) => {
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
}

module.exports = FlowClass
