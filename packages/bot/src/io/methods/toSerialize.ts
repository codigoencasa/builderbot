import type { TContext } from '../../types'
import { generateRefSerialize } from '../../utils/hash'

/**
 * Crear referencia serializada
 * @param flowJson - Array de objetos que se van a serializar.
 * @returns Array de objetos serializados.
 */
const toSerialize = (flowJson: TContext | TContext[] | Partial<TContext> | Partial<TContext>[]): TContext[] => {
    if (!Array.isArray(flowJson)) throw new Error('Esto debe ser un ARRAY')

    const jsonToSerialize: TContext[] = flowJson.map((row, index) => ({
        ...row,
        refSerialize: generateRefSerialize({
            index,
            keyword: row.keyword,
            answer: row.answer,
        }),
    }))

    return jsonToSerialize
}

export { toSerialize }
