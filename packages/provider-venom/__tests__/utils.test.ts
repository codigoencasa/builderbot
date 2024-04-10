import { describe, expect, test } from '@jest/globals'
import { notMatches, venomCleanNumber, venomisValidNumber } from '../src/utils'

describe('#venomCleanNumber', () => {
    test('should clear the number properly', () => {
        const numeroLimpio = venomCleanNumber('+123 456 789')
        expect(numeroLimpio).toBe('123456789@c.us')
    })

    test('I should clear the entire number', () => {
        const numeroLimpio = venomCleanNumber('+123 456 789', true)
        expect(numeroLimpio).toBe('123456789')
    })
})

describe('#venomisValidNumber', () => {
    test('should return true for a valid number', () => {
        const esValido = venomisValidNumber('123456789@c.us')
        expect(esValido).toBe(true)
    })

    test('should return false for an invalid number', () => {
        const esValido = venomisValidNumber('123456789@g.us')
        expect(esValido).toBe(false)
    })
})

describe('#notMatches', () => {
    test('should return true for null', () => {
        const resultado = notMatches(null)
        expect(resultado).toBe(true)
    })

    test('should return true for an array with length other than 3', () => {
        const matches = ['data:image/png;base64,base64String']
        const resultado = notMatches(matches as RegExpMatchArray)
        expect(resultado).toBe(true)
    })

    test('should return false for an array with length 3', () => {
        const matches = ['data:image/png;base64', 'image/png', 'base64String']
        const resultado = notMatches(matches as RegExpMatchArray)
        expect(resultado).toBe(false)
    })
})
