import { toSerialize } from './methods/toSerialize'
import type { MessageContextIncoming, TContext, TFlow } from '../types'
import { printer } from '../utils'
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

        const isSkipIdOption = this.flowSerialize.some((flow) => Boolean(flow.options.skip_id))
        const hasDynamicCallback = this.flowSerialize.some((flow) => Boolean(flow.options.dynamicCapture !== undefined))

        if (isSkipIdOption) {
            printer(
                'Asegurate de configurar la función `addDynamicAction` y validar `skip_id` option para controlar su efecto.',
                '`skip_id` Option Activo, Esta opción puede interrumpir el flujo ordenado.'
            )
        }

        if (hasDynamicCallback) {
            if (isSkipIdOption) {
                console.time('Configurando skips')

                const idIndexMap = new Map(this.flowSerialize.map((f, idx) => [f.options?.id, idx]))

                this.flowSerialize.forEach((f1, currentIndex) => {
                    const skipId = f1.options?.skip_id
                    if (skipId) {
                        const pointIndex = idIndexMap.get(skipId)
                        if (pointIndex && pointIndex > currentIndex) {
                            for (let i = currentIndex + 1; i < pointIndex; i++) {
                                const f = this.flowSerialize[i]

                                if (f.answer !== '__capture_only_intended__' && f.options.id === skipId) {
                                    break
                                }

                                if (!f.options?.dynamicCapture) {
                                    f.options.dynamicCapture = async (ctx: any) => Boolean(ctx?.preDynamic)
                                }
                            }
                        }
                    }
                })

                console.timeEnd('Configurando skips')
            }
        }
    }

    async find(
        keyOrWord: string | { keyOrWord: string; messageCtxInComing: MessageContextIncoming },
        symbol: boolean = false,
        overFlow: TContext[] | null = null
    ): Promise<TContext[]> {
        let capture = false
        let messages: TContext[] = []
        let refSymbol: TContext | null = null
        overFlow = overFlow ?? this.flowSerialize

        let messageCtxInComing: MessageContextIncoming = undefined

        if (typeof keyOrWord !== 'string') {
            messageCtxInComing = keyOrWord.messageCtxInComing
            keyOrWord = keyOrWord.keyOrWord
        }

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

        const findIn = async (keyOrWord: string, symbol: boolean, flow: TContext[]): Promise<void> => {
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
        await findIn(keyOrWord, symbol, overFlow)

        const hasDynamicMessages = messages.some((msg) => !!(typeof msg.options.dynamicCapture !== 'undefined'))

        if (hasDynamicMessages) {
            const filteredMessages = []

            for (const msg of messages) {
                if (msg?.options?.dynamicCapture) {
                    const ispassed = await msg.options.dynamicCapture(messageCtxInComing)
                    // @ts-expect-error "preDynamic is not present into legal interface"
                    messageCtxInComing.preDynamic = ispassed

                    if (ispassed) {
                        filteredMessages.push(msg)
                    }
                } else {
                    filteredMessages.push(msg)
                }
            }

            messages = filteredMessages

            return messages
        }

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
