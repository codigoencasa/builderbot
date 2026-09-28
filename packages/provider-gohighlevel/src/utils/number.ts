/**
 * LAYER: Infrastructure
 * Contains: Number
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Number]
 * GOAL: Own the "number" concern of the provider-gohighlevel package.
 */
export const parseGHLNumber = (number: string): string => {
    if (typeof number !== 'string') return number
    // Remove all non-numeric characters: +, spaces, dashes, parentheses, etc.
    number = number.replace(/[^\d]/g, '')
    return number
}
