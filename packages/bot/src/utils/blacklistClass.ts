class BlackList {
    private blacklist: Set<string> = new Set()

    /**
     * Constructor de la clase BlackList.
     * @param initialNumbers - Números iniciales para agregar a la lista negra.
     */
    constructor(initialNumbers: string[] = []) {
        this.add(initialNumbers)
    }

    /**
     * Verifica si la lista blanca está activada.
     * @returns Verdadero si algún número en la lista negra empieza con '!', falso en caso contrario.
     */
    private isWhiteListActivated(): boolean {
        return Array.from(this.blacklist).some((value) => value.startsWith('!'))
    }

    /**
     * Agrega uno o más números de teléfono a la lista negra.
     * @param phoneNumbers - Número(s) de teléfono a agregar.
     * @returns Mensajes de respuesta indicando el resultado de la operación.
     */
    add(phoneNumbers: string | string[]): string[] {
        const responseMessages: string[] = []
        const numbersToAdd = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers]

        numbersToAdd.flat().forEach((number: string) => {
            if (this.blacklist.has(number)) {
                responseMessages.push(`El número de teléfono ${number} ya está en la lista negra.`)
            } else {
                this.blacklist.add(number)
                responseMessages.push(`Número ${number} añadido exitosamente.`)
            }
        })

        return responseMessages
    }

    /**
     * Elimina un número de teléfono de la lista negra.
     * @param phoneNumber - Número de teléfono a eliminar.
     * @throws Error si el número no está en la lista negra.
     */
    remove(phoneNumber: string): void {
        if (!this.blacklist.has(phoneNumber)) {
            throw new Error(`El número de teléfono ${phoneNumber} no está en la lista negra.`)
        }
        this.blacklist.delete(phoneNumber)
    }

    /**
     * Verifica si un número de teléfono está en la lista negra.
     * @param phoneNumber - Número de teléfono a verificar.
     * @returns Verdadero si el número está en la lista negra, falso en caso contrario.
     */
    checkIf(phoneNumber: string): boolean {
        if (this.isWhiteListActivated()) {
            return !this.blacklist.has(`!${phoneNumber}`)
        }
        return this.blacklist.has(phoneNumber)
    }

    /**
     * Obtiene la lista de números en la lista negra.
     * @returns Un array con los números en la lista negra.
     */
    getList(): string[] {
        return Array.from(this.blacklist)
    }
}

export { BlackList }
