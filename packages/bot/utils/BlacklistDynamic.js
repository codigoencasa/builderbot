class DynamicBlacklist {
    #blacklist = new Set()

    /**
     * Constructor para inicializar la lista negra.
     * @param {Array<string>} initialNumbers - Lista inicial de números a bloquear.
     */
    constructor(initialNumbers = []) {
        this.addToBlacklist(initialNumbers)
    }

    /**
     * Excepción lanzada cuando un número ya existe en la lista negra.
     */
    static PhoneNumberAlreadyExistsError = class extends Error {
        constructor(phoneNumber) {
            super(`El número de teléfono ${phoneNumber} ya está en la lista negra.`)
            this.name = 'PhoneNumberAlreadyExistsError'
        }
    }

    /**
     * Excepción lanzada cuando un número no se encuentra en la lista negra.
     */
    static PhoneNumberNotFoundError = class extends Error {
        constructor(phoneNumber) {
            super(`El número de teléfono ${phoneNumber} no está en la lista negra.`)
            this.name = 'PhoneNumberNotFoundError'
        }
    }

    /**
     * Añade uno o varios números de teléfono a la lista negra.
     * @param {string | Array<string>} phoneNumbers - Número o números a añadir.
     * @returns {Array<string>} - Devuelve una lista de mensajes indicando el resultado de añadir cada número.
     */
    addToBlacklist(...phoneNumbers) {
        const responseMessages = []

        phoneNumbers.flat().forEach((number) => {
            if (this.#blacklist.has(number)) {
                responseMessages.push(`El número de teléfono ${number} ya está en la lista negra.`)
            } else {
                this.#blacklist.add(number)
                responseMessages.push(`Número ${number} añadido exitosamente.`)
            }
        })

        return responseMessages
    }

    /**
     * Elimina un número de teléfono de la lista negra.
     * @param {string} phoneNumber - El número a eliminar.
     */
    removeFromBlacklist(phoneNumber) {
        if (!this.#blacklist.has(phoneNumber)) {
            throw new DynamicBlacklist.PhoneNumberNotFoundError(phoneNumber)
        }
        this.#blacklist.delete(phoneNumber)
    }

    /**
     * Verifica si un número de teléfono está en la lista negra.
     * @param {string} phoneNumber - El número a verificar.
     * @returns {boolean} - Verdadero si está en la lista, falso en caso contrario.
     */
    isInBlacklist(phoneNumber) {
        return this.#blacklist.has(phoneNumber)
    }

    /**
     * Proporciona una copia de la lista negra actual.
     * @returns {Array<string>} - Los números de teléfono en la lista negra.
     */
    getBlacklistSnapshot() {
        return [...this.#blacklist]
    }
}
module.exports = DynamicBlacklist
