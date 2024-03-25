const parseNumber = (number: string): string => {
    return number.replace(/(?:whatsapp:|\+\d+)/, '').replace(/\s/g, '')
}

const parseNumberFrom = (number: string): string => {
    const cleanNumber = number.replace(/whatsapp|:|\+/g, '').replace(/\s/g, '')
    return `whatsapp:+${cleanNumber}`
}

export { parseNumber, parseNumberFrom }
