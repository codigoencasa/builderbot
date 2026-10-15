/**
 * LAYER: Domain
 * Contains: flatObject — flattens nested flows into a lookup map
 * Rules: Pure data transformation. No external side effects.
 * BigO: O(n^2) score:1
 * keywords: [flatObject, TFlow, FlowClass]
 * GOAL: Build the flow lookup table the runtime uses to resolve answers. Nested loops cover bounded nested flows.
 */
import type { TFlow } from '../types'

/**
 * Convierte una lista de objetos anidados en un objeto plano,
 * utilizando las funciones de devolución de llamada proporcionadas.
 * @param listArray Lista de objetos anidados.
 * @returns Objeto plano resultante.
 */
const flatObject = <P>(listArray: TFlow<P>[] = []): Record<string, Function> => {
    const cbNestedList = Array.isArray(listArray) ? listArray : []

    if (!cbNestedList.length) return {}

    const cbNestedObj = cbNestedList.map(({ ctx }) => ctx?.callbacks).filter(Boolean)

    const flatObj = cbNestedObj.reduce((acc, current) => {
        const keys = Object.keys(current)
        const values = Object.values(current)

        keys.forEach((key, i) => {
            acc[key] = values[i]
        })

        return acc
    }, {})

    return flatObj
}

export default flatObject
