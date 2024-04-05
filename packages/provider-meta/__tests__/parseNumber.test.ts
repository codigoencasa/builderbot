import { describe, expect, test } from '@jest/globals'
import { parseMetaNumber } from '../src/utils'

describe('#parseMetaNumber ', () => {
    test('should parse a meta number correctly', () => {
        // Arrange
        const inputNumber = '+123 456 789'
        const expectedOutput = '123456789'

        // Act
        const result = parseMetaNumber(inputNumber)

        // Assert
        expect(result).toBe(expectedOutput)
    })

    test('should handle empty input', () => {
        // Arrange
        const inputNumber = ''
        const expectedOutput = ''

        // Act
        const result = parseMetaNumber(inputNumber)

        // Assert
        expect(result).toBe(expectedOutput)
    })

    test('should handle input with no spaces or plus signs', () => {
        // Arrange
        const inputNumber = '123456789'
        const expectedOutput = '123456789'

        // Act
        const result = parseMetaNumber(inputNumber)

        // Assert
        expect(result).toBe(expectedOutput)
    })
})
