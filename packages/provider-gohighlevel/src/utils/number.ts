export const parseGHLNumber = (number: string): string => {
    if (typeof number !== 'string') return number
    // Remove all non-numeric characters: +, spaces, dashes, parentheses, etc.
    number = number.replace(/[^\d]/g, '')
    return number
}
