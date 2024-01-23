import crypto from 'crypto'

/**
 * Generamos un UUID unico con posibilidad de tener un prefijo
 * @param {*} prefix
 * @returns
 */
export const generateRefprovider = (prefix = '') => {
    const id = crypto.randomUUID()
    return prefix ? `${prefix}_${id}` : id
}
