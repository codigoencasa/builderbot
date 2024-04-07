import { describe, expect, test } from '@jest/globals'
import { parseNumber, parseNumberFrom } from '../src/utils'

describe('#parseNumber ', () => {
    test('should parse number correctly by removing "whatsapp:" and spaces', () => {
        // Arrange
        const phoneNumber = 'whatsapp: +123 456 789'

        // Act
        const result = parseNumber(phoneNumber)

        // Assert
        expect(result).toBe('+123456789')
    })

    test('should handle numbers without spaces correctly', () => {
        // Arrange
        const phoneNumber = 'whatsapp:+111222333'

        // Act
        const result = parseNumber(phoneNumber)

        // Assert
        expect(result).toBe('+111222333')
    })
})

describe('#parseNumberFrom ', () => {
    test('should parse number correctly by removing "whatsapp:", "+" and spaces', () => {
        // Arrange
        const phoneNumber = 'whatsapp: +123 456 789'

        // Act
        const result = parseNumberFrom(phoneNumber)

        // Assert
        expect(result).toBe('whatsapp:+123456789')
    })

    test('should handle numbers without "whatsapp:" correctly', () => {
        // Arrange
        const phoneNumber = '+987 654 321'

        // Act
        const result = parseNumberFrom(phoneNumber)

        // Assert
        expect(result).toBe('whatsapp:+987654321')
    })

    test('should handle numbers without spaces correctly', () => {
        // Arrange
        const phoneNumber = 'whatsapp:+111222333'

        // Act
        const result = parseNumberFrom(phoneNumber)

        // Assert
        expect(result).toBe('whatsapp:+111222333')
    })
})
