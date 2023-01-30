import { generateRefSerialize } from '../../utils/hash'

interface flow {
    keyword: string
    answer: string
}

/**
 * Crear referencia serializada
 * @param {*} flowJson
 * @returns array[]
 */
export const toSerialize = (flowJson: flow) => {
    if (!Array.isArray(flowJson)) throw new Error('Esto debe ser un ARRAY')

    const jsonToSerialize = flowJson.map((row, index) => ({
        ...row,
        refSerialize: `${generateRefSerialize({
            index,
            keyword: row.keyword,
            answer: row.answer,
        })}`,
    }))

    return jsonToSerialize
}
