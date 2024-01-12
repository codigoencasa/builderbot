class BlackList {
    blacklist: Set<string> = new Set()

    constructor(initialNumbers: string[] = []) {
        this.add(initialNumbers)
    }

    add(phoneNumbers: string | string[]): string[] {
        const responseMessages: string[] = []
        phoneNumbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers]
        phoneNumbers.flat().forEach((number: string) => {
            if (this.blacklist.has(number)) {
                responseMessages.push(`El número de teléfono ${number} ya está en la lista negra.`)
            } else {
                this.blacklist.add(number)
                responseMessages.push(`Número ${number} añadido exitosamente.`)
            }
        })

        return responseMessages
    }

    remove(phoneNumber: string): void {
        if (!this.blacklist.has(phoneNumber)) {
            throw new Error(phoneNumber)
        }
        this.blacklist.delete(phoneNumber)
    }

    checkIf(phoneNumber: string): boolean {
        return this.blacklist.has(phoneNumber)
    }

    getList(): string[] {
        return Array.from(this.blacklist)
    }
}

export { BlackList }
