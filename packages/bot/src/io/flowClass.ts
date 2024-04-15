import { toSerialize } from './methods/toSerialize'
import type { TContext, TFlow } from '../types'
import flatObject from '../utils/flattener'

/**
 * Esta clase se encarga de manejar la manipulación de los flows
 * y la creación de índices donde almacenar los callbacks.
 */
class FlowClass {
    allCallbacks: Record<string, Function>
    flowSerialize: TContext[]
    flowRaw: TFlow[]

    constructor(_flow: TFlow[]) {
        if (!Array.isArray(_flow)) throw new Error('Must be an array of flows')
        this.flowRaw = _flow

        this.allCallbacks = flatObject(_flow)

        const mergeToJsonSerialize: Partial<TContext>[] = _flow.map((flowItem) => flowItem.toJson()).flat(2)

        this.flowSerialize = toSerialize(mergeToJsonSerialize)
    }

    find(keyOrWord: string, symbol: boolean = false, overFlow: TContext[] | null = null): TContext[] {
        let capture = false
        const messages: any[] = []
        let refSymbol: TContext | null = null
        overFlow = overFlow ?? this.flowSerialize

        const mapSensitive = (str: string | string[], mapOptions: { sensitive: boolean; regex: boolean }): RegExp => {
            if (mapOptions.regex) return new Function(`return ${str}`)()
            const regexSensitive = mapOptions.sensitive ? 'g' : 'i'

            if (Array.isArray(str)) {
                const patterns = mapOptions.sensitive ? str.map((item) => `\\b${item}\\b`) : str
                return new RegExp(patterns.join('|'), regexSensitive)
            }
            const pattern = mapOptions.sensitive ? `\\b${str}\\b` : str
            return new RegExp(pattern, regexSensitive)
        }

        const findIn = (keyOrWord: string, symbol: boolean, flow: TContext[]): void => {
            capture = refSymbol?.options?.capture || false
            if (capture) return

            if (symbol) {
                refSymbol = flow.find((c) => c.keyword === keyOrWord)
                if (refSymbol?.answer) messages.push(refSymbol)
                if (refSymbol?.ref) findIn(refSymbol.ref, true, flow)
            } else {
                refSymbol = flow.find((c) => {
                    const sensitive = c?.options?.sensitive || false
                    const regex = c?.options?.regex || false
                    return mapSensitive(c.keyword!, { sensitive, regex }).test(keyOrWord)
                })
                if (refSymbol?.ref) findIn(refSymbol.ref, true, flow)
            }
        }
        findIn(keyOrWord, symbol, overFlow)
        return messages
    }

    findBySerialize(refSerialize: string, k: number = 0): TContext | undefined {
        const index = this.flowSerialize.findIndex((r) => r.refSerialize === refSerialize)
        return this.flowSerialize[index - k]
    }

    findIndexByRef(ref: string): number {
        return this.flowSerialize.findIndex((r) => r.ref === ref)
    }

    findSerializeByRef(ref: string): TContext | undefined {
        return this.flowSerialize.find((r) => r.ref === ref)
    }

    findSerializeByKeyword(keyword: string): TContext | undefined {
        return this.flowSerialize.find((r) => r.keyword === keyword)
    }

    getRefToContinueChild(keyword: string): TContext | undefined {
        try {
            const flowChilds = this.flowSerialize.reduce((acc, cur) => {
                const merge = [...acc, cur?.options?.nested].flat(2)
                return merge
            }, [] as TContext[])

            return flowChilds.filter((i) => !!i && i?.refSerialize === keyword).shift() as TContext
        } catch (e) {
            return undefined
        }
    }

    getFlowsChild(): TContext[] {
        try {
            const flowChilds = this.flowSerialize
                .reduce((acc, cur) => {
                    const merge = [...acc, cur?.options?.nested].flat(2)
                    return merge
                }, [] as TContext[])
                .filter((i) => !!i)

            return flowChilds
        } catch (e) {
            return []
        }
    }
}

export default FlowClass
