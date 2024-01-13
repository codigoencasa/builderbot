const parseNumber = (number: string): string => {
    return `${number}`.replace('whatsapp:', '').replace('+', '')
}

export { parseNumber }
