const parseNumber = (number: string): string => {
    return number.replace(/(?:whatsapp:|\+\d+)/, '')
}

const parseNumberFrom = (number: string): string => {
    const cleanNumber = number.replace(/whatsapp|:|\+/g, '')
    return `whatsapp:+${cleanNumber}`
}

export { parseNumber, parseNumberFrom }
