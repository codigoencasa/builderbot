import { randomUUID, createHash, createCipheriv, createDecipheriv } from 'crypto'

const SALT_KEY = `sal-key-${Date.now()}`
const SALT_IV = `sal-iv-${Date.now()}`
const METHOD = 'aes-256-cbc'

const key = createHash('sha512').update(SALT_KEY).digest('hex').substring(0, 32)
const encryptionIV = createHash('sha512').update(SALT_IV).digest('hex').substring(0, 16)

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

/**
 * Generamos un UUID único con posibilidad de tener un prefijo
 * @param prefix - Prefijo opcional para el UUID
 * @returns Un UUID único, opcionalmente con prefijo
 */
const generateRefProvider = (prefix?: string): string => {
    const id: string = randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

/**
 * Encriptar data
 * @param data - Datos a encriptar
 * @returns Datos encriptados en base64
 */
const encryptData = (data: string): string => {
    const cipher = createCipheriv(METHOD, key, encryptionIV)
    return Buffer.from(cipher.update(data, 'utf8', 'hex') + cipher.final('hex')).toString('base64')
}

/**
 * Desencriptar data
 * @param encryptedData - Datos encriptados en base64
 * @returns Datos desencriptados o 'FAIL' en caso de error
 */
const decryptData = (encryptedData: string): string => {
    try {
        const buff = Buffer.from(encryptedData, 'base64')
        const decipher = createDecipheriv(METHOD, key, encryptionIV)
        return decipher.update(buff.toString('utf8'), 'hex', 'utf8') + decipher.final('utf8')
    } catch (e) {
        console.error(e)
        return 'FAIL'
    }
}
/**
 *
 * @param prefix
 * @returns
 */
const generateRegex = (prefix: string): RegExp => {
    return new RegExp(`^${prefix}__[\\w\\d]{8}-(?:[\\w\\d]{4}-){3}[\\w\\d]{12}$`)
}

export { generateRef, generateRefSerialize, generateTime, generateRegex, generateRefProvider, encryptData, decryptData }
