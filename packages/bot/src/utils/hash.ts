import { createHash, randomUUID } from 'node:crypto'

/**
 * Generamos un UUID unico con posibilidad de tener un prefijo
 * @param {*} prefix
 * @returns
 */
export const generateRef = (prefix = false) => {
    const id = randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

interface generateRefSerializeProps {
    index: number
    answer: string
    keyword: string
}
/**
 * Genera un HASH MD5
 * @param {*} param0
 * @returns
 */
export const generateRefSerialize = ({
    index,
    answer,
    keyword,
}: generateRefSerializeProps) =>
    createHash('md5')
        .update(JSON.stringify({ index, answer, keyword }))
        .digest('hex')
