import { describe, expect, test } from '@jest/globals'

import { isBSUID, parseMetaNumber, resolveOutboundAddress } from '../src/utils'

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

    test('should leave a BSUID unchanged (the period and case must be preserved)', () => {
        // Arrange — Meta requires the entire BSUID value to be sent unmodified
        const bsuid = 'US.13491208655302741918'

        // Act
        const result = parseMetaNumber(bsuid)

        // Assert
        expect(result).toBe(bsuid)
    })

    test('should leave a BSUID unchanged even if it contains characters parseMetaNumber would otherwise strip', () => {
        // Arrange — a BSUID never contains '+' or whitespace per the docs, but we guard before stripping
        const bsuid = 'BR.1A2B3C4D5E6F7G8H9I0J'

        // Act
        const result = parseMetaNumber(bsuid)

        // Assert
        expect(result).toBe(bsuid)
    })
})

describe('#isBSUID ', () => {
    test('should return true for a valid BSUID', () => {
        expect(isBSUID('US.13491208655302741918')).toBe(true)
        expect(isBSUID('BR.1A2B3C4D5E6F7G8H9I0J')).toBe(true)
    })

    test('should return false for a plain phone number', () => {
        expect(isBSUID('+1 234 567 890')).toBe(false)
        expect(isBSUID('5491123456789')).toBe(false)
    })

    test('should return false for non-string input', () => {
        expect(isBSUID(undefined as unknown as string)).toBe(false)
        expect(isBSUID(null as unknown as string)).toBe(false)
        expect(isBSUID(12345 as unknown as string)).toBe(false)
    })

    test('should return false for malformed BSUID-like strings', () => {
        expect(isBSUID('us.13491208655302741918')).toBe(false) // lowercase country code
        expect(isBSUID('USA.13491208655302741918')).toBe(false) // 3-letter country code
        expect(isBSUID('US13491208655302741918')).toBe(false) // missing period
        expect(isBSUID('US.')).toBe(false) // empty identifier
    })
})

describe('#resolveOutboundAddress ', () => {
    test('should map a phone number to Graph `to`', () => {
        expect(resolveOutboundAddress('+57 300 111 2233')).toEqual({ to: '573001112233' })
        expect(resolveOutboundAddress('573001112233')).toEqual({ to: '573001112233' })
    })

    test('should map a BSUID to Graph `recipient` (Jose Santos fixture)', () => {
        expect(resolveOutboundAddress('CO.2177313826172406')).toEqual({
            recipient: 'CO.2177313826172406',
        })
    })
})
