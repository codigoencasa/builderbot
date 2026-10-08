/**
 * LAYER: Infrastructure
 * Contains: Utils
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Utils]
 * GOAL: Own the "utils" concern of the provider-twilio package.
 */
const parseNumber = (number: string): string => {
    return number.replace(/(?:whatsapp:|\+\d+)/, '').replace(/\s/g, '')
}

const parseNumberFrom = (number: string): string => {
    const cleanNumber = number.replace(/whatsapp|:|\+/g, '').replace(/\s/g, '')
    return `whatsapp:+${cleanNumber}`
}

export { parseNumber, parseNumberFrom }
