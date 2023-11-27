const { toSerialize } = require('./methods/toSerialize')
const { flatObject } = require('../utils/flattener')

/**
 * Esta clas se encarga de manera la manipulacion de los flows
 * y la creaciones de indices donde almacenar los callbacks
 */
class FlowClass {
    allCallbacks = []
    flowSerialize = []
    flowRaw = []

    constructor(_flow) {
        if (!Array.isArray(_flow)) throw new Error('Esto debe ser un ARRAY')
        // this.flowRaw = this.addEndsFlows(_flow)
        this.flowRaw = _flow

        this.allCallbacks = flatObject(_flow)

        const mergeToJsonSerialize = Object.keys(_flow)
            .map((indexObjectFlow) => _flow[indexObjectFlow].toJson())
            .flat(2)

        this.flowSerialize = toSerialize(mergeToJsonSerialize)
    }

    /**
     * Agregamos un addAcion con un endFlow
     * al finalizar el flow para limpiar rendimiento, colas, etc
     * @param {*} _flows
     * @returns
     */
    addEndsFlows = (_flows) => {
        return _flows.map((flow) =>
            flow.addAction(async (_, { endFlow }) => {
                return endFlow()
            })
        )
    }

    /**
     * Funcion principal encargada de devolver un array de mensajes a continuar
     * la idea es basado en un ref o id devolver la lista de mensaes a enviar
     * @param {*} keyOrWord
     * @param {*} symbol
     * @param {*} overFlow
     * @returns
     */
    find = (keyOrWord, symbol = false, overFlow = null) => {
        keyOrWord = `${keyOrWord}`
        let capture = false
        let messages = []
        let refSymbol = null
        overFlow = overFlow ?? this.flowSerialize

        const mapSensitive = (str, mapOptions = { sensitive: false, regex: false }) => {
            if (mapOptions.regex) return new Function(`return ${str}`)()
            const regexSensitive = mapOptions.sensitive ? 'g' : 'i'

            if (Array.isArray(str)) {
                const patterns = mapOptions.sensitive ? str.map((item) => `\\b${item}\\b`) : str
                return new RegExp(patterns.join('|'), regexSensitive)
            }
            const pattern = mapOptions.sensitive ? `\\b${str}\\b` : str
            return new RegExp(pattern, regexSensitive)
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

    findSerializeByRef = (ref) => this.flowSerialize.find((r) => r.ref === ref)

    findSerializeByKeyword = (keyword) => this.flowSerialize.find((r) => r.keyword === keyword)

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

    /**
     * El proposito es cargar los flows y la serializacion de los callbacks
     * a los flows qu son hijos
     * @returns
     */
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
