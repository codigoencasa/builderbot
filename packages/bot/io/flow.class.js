class FlowClass {
    flow
    constructor(_flow) {
        this.flow = _flow
    }

    find = (keyOrWord, symbol = false) => {
        let messages = []
        const findIn = (keyOrWord, symbol = false, flow = this.flow) => {
            if (symbol) {
                const refSymbol = flow.find((c) => c.keyword === keyOrWord)
                if (refSymbol && refSymbol.answer)
                    messages.push(refSymbol.answer)
                if (refSymbol && refSymbol.ref) findIn(refSymbol.ref, true)
            } else {
                const refSymbolByKeyworkd = flow.find((c) =>
                    c.keyword.includes(keyOrWord)
                )
                if (refSymbolByKeyworkd && refSymbolByKeyworkd.ref)
                    findIn(refSymbolByKeyworkd.ref, true)

                return messages
            }
        }
        findIn(keyOrWord, symbol)
        return messages
    }
}

module.exports = FlowClass
