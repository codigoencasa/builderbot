import { randomUUID, createHash } from 'crypto'

/**
 * Genera un UUID único con posibilidad de tener un prefijo.
 * @param prefix Prefijo opcional para el UUID.
 * @returns El UUID generado.
 */
const generateRef = (prefix?: string): string => {
    const id = randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

/**
 * Genera un timestamp en milisegundos sin prefijo hex.
 * @returns El timestamp generado.
 */
const generateTime = (): number => {
    return Date.now()
}

/**
 * Genera un HASH MD5 a partir de un objeto serializado como cadena JSON.
 * @param param0 Objeto con propiedades index, answer y keyword.
 * @returns El HASH MD5 generado.
 */
const generateRefSerialize = ({
    index,
    answer,
    keyword,
}: {
    index: number
    answer: string | string[]
    keyword?: string | string[]
}): string => {
    return createHash('md5').update(JSON.stringify({ index, answer, keyword })).digest('hex')
}

export { generateRef, generateRefSerialize, generateTime }
