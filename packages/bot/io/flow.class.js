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

        const mapSensitive = (str, mapOptions = { sensitive: false, regex: false }) => {
            if (mapOptions.regex) return new RegExp(str)
            const regexSensitive = mapOptions.sensitive ? 'g' : 'i'
            if (Array.isArray(str)) {
                return new RegExp(str.join('|'), regexSensitive)
            }
            return new RegExp(str, regexSensitive)
        }

        const findIn = (keyOrWord, symbol = false, flow = overFlow) => {
            capture = refSymbol?.options?.capture || false
            if (capture) return messages

            if (symbol) {
                refSymbol = flow.find((c) => c.keyword === keyOrWord)
                if (refSymbol?.answer) messages.push(refSymbol)
                if (refSymbol?.ref) findIn(refSymbol.ref, true)
            } else {
                refSymbol = flow.find((c) => {
                    const sensitive = c?.options?.sensitive || false
                    const regex = c?.options?.regex || false
                    return mapSensitive(c.keyword, { sensitive, regex }).test(keyOrWord)
                })
                if (refSymbol?.ref) findIn(refSymbol.ref, true)
                return messages
            }
        }
        findIn(keyOrWord, symbol)
        return messages
    }

    findBySerialize = (refSerialize) => this.flowSerialize.find((r) => r.refSerialize === refSerialize)

    findIndexByRef = (ref) => this.flowSerialize.findIndex((r) => r.ref === ref)

    getRefToContinueChild = (keyword) => {
        try {
            const flowChilds = this.flowSerialize
                .reduce((acc, cur) => {
                    const merge = [...acc, cur?.options?.nested].flat(2)
                    return merge
                }, [])
                .filter((i) => !!i && i?.refSerialize === keyword)
                .shift()

            return flowChilds
        } catch (e) {
            return undefined
        }
    }

    getFlowsChild = () => {
        try {
            const flowChilds = this.flowSerialize
                .reduce((acc, cur) => {
                    const merge = [...acc, cur?.options?.nested].flat(2)
                    return merge
                }, [])
                .filter((i) => !!i)

            return flowChilds
        } catch (e) {
            return []
        }
    }
}

module.exports = FlowClass
