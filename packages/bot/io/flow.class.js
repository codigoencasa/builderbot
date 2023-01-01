const { toSerialize } = require('./methods/toSerialize')
const { flatObject } = require('../utils/flattener')

class FlowClass {
    allCallbacks = []
    flowSerialize = []
    flowRaw = []
    constructor(_flow) {
        if (!Array.isArray(_flow)) throw new Error('Esto debe ser un ARRAY')
        this.flowRaw = _flow

        this.allCallbacks = flatObject(_flow)

        const mergeToJsonSerialize = Object.keys(_flow)
            .map((indexObjectFlow) => _flow[indexObjectFlow].toJson())
            .flat(2)

        this.flowSerialize = toSerialize(mergeToJsonSerialize)
    }

    find = (keyOrWord, symbol = false, overFlow = null) => {
        keyOrWord = `${keyOrWord}`
        let capture = false
        let messages = []
        let refSymbol = null
        overFlow = overFlow ?? this.flowSerialize

        /** Retornar expresion regular para buscar coincidencia */
        const mapSensitive = (str, flag = false) => {
            const regexSensitive = flag ? 'g' : 'i'
            if (Array.isArray(str)) {
                return new RegExp(str.join('|'), regexSensitive)
            }
            return new RegExp(str, regexSensitive)
        }

        const findIn = (keyOrWord, symbol = false, flow = overFlow) => {
            const sensitive = refSymbol?.options?.sensitive || false
            capture = refSymbol?.options?.capture || false

            if (capture) return messages

            if (symbol) {
                refSymbol = flow.find((c) => c.keyword === keyOrWord)
                if (refSymbol?.answer) messages.push(refSymbol)
                if (refSymbol?.ref) findIn(refSymbol.ref, true)
            } else {
                refSymbol = flow.find((c) => {
                    return mapSensitive(c.keyword, sensitive).test(keyOrWord)
                })
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
