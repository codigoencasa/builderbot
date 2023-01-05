const parseNumber = (number) => {
    return `${number}`.replace('whatsapp:', '').replace('+', '')
}

module.exports = { parseNumber }
