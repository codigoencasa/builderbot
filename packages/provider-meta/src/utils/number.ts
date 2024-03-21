export const parseMetaNumber = (number: string): string => {
    number = number.replace(/\+/g, '')
    return number
}
