import { decryptData, encryptData } from './hash'
/**
 *
 * @param fullHash
 * @returns
 */
export const getEventName = (fullHash: string): string | null => {
    return decryptData(fullHash)
}
/**
 *
 * @param name
 * @returns
 */
export const setEvent = (name: string) => {
    return encryptData(`_event_custom_${name}_`)
}

/**
 *
 * @param phone
 * @returns
 */
export const removePlus = (phone: string) => phone.replace('+', '').replace(/\s/g, '')
