/**
 * LAYER: Infrastructure
 * Contains: getEventName / setEvent / removePlus — event-name registry and phone helpers
 * Rules: Uses crypto utilities. Technical helpers, no business rules.
 * BigO: O(1) score:5
 * keywords: [getEventName, setEvent, removePlus]
 * GOAL: Map hashed context references to event names and normalize phone strings.
 */
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
