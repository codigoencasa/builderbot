import crypto from 'crypto'

const SALT_KEY = `sal-key-${Date.now()}`
const SALT_IV = `sal-iv-${Date.now()}`

const METHOD = 'aes-256-cbc'

const key = crypto.createHash('sha512').update(SALT_KEY).digest('hex').substring(0, 32)

const encryptionIV = crypto.createHash('sha512').update(SALT_IV).digest('hex').substring(0, 16)

/**
 * Generamos un UUID único con posibilidad de tener un prefijo
 * @param prefix - Prefijo opcional para el UUID
 * @returns Un UUID único, opcionalmente con prefijo
 */
const generateRefprovider = (prefix?: string): string => {
    const id: string = crypto.randomUUID()
    return prefix ? `${prefix}_${id}` : id
}

/**
 * Encriptar data
 * @param data - Datos a encriptar
 * @returns Datos encriptados en base64
 */
const encryptData = (data: string): string => {
    const cipher = crypto.createCipheriv(METHOD, key, encryptionIV)
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
        const decipher = crypto.createDecipheriv(METHOD, key, encryptionIV)
        return decipher.update(buff.toString('utf8'), 'hex', 'utf8') + decipher.final('utf8')
    } catch (e) {
        console.error(e)
        return 'FAIL'
    }
}

export { generateRefprovider, encryptData, decryptData }
