export const parseMetaNumber = (number: string): string => {
    number = number.replace(/\+/g, '').replace(/\s/g, '')
    return number
}
