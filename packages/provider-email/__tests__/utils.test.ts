import { describe, expect, test } from '@jest/globals'

import {
    extractEmailAddress,
    extractEmailName,
    isValidEmail,
    cleanEmail,
    parseEmailList,
    formatEmailAddress,
    htmlToText,
    isHtml,
    extractThreadId,
    isReplySubject,
    stripReplyPrefix,
    addReplyPrefix,
    parseMimeType,
    mimeToExtension,
} from '../src/utils'

describe('#extractEmailAddress', () => {
    test('should extract email from "Name <email>" format', () => {
        const input = 'John Doe <john@example.com>'
        const result = extractEmailAddress(input)
        expect(result).toBe('john@example.com')
    })

    test('should handle plain email address', () => {
        const input = 'john@example.com'
        const result = extractEmailAddress(input)
        expect(result).toBe('john@example.com')
    })

    test('should handle email with quotes in name', () => {
        const input = '"John Doe" <john@example.com>'
        const result = extractEmailAddress(input)
        expect(result).toBe('john@example.com')
    })

    test('should return empty string for empty input', () => {
        const result = extractEmailAddress('')
        expect(result).toBe('')
    })
})

describe('#extractEmailName', () => {
    test('should extract name from "Name <email>" format', () => {
        const input = 'John Doe <john@example.com>'
        const result = extractEmailName(input)
        expect(result).toBe('John Doe')
    })

    test('should handle quoted name', () => {
        const input = '"John Doe" <john@example.com>'
        const result = extractEmailName(input)
        expect(result).toBe('John Doe')
    })

    test('should return empty string for plain email', () => {
        const input = 'john@example.com'
        const result = extractEmailName(input)
        expect(result).toBe('')
    })
})

describe('#isValidEmail', () => {
    test('should return true for valid email', () => {
        expect(isValidEmail('john@example.com')).toBe(true)
        expect(isValidEmail('test.user@domain.org')).toBe(true)
    })

    test('should return false for invalid email', () => {
        expect(isValidEmail('invalid')).toBe(false)
        expect(isValidEmail('invalid@')).toBe(false)
        expect(isValidEmail('@domain.com')).toBe(false)
        expect(isValidEmail('')).toBe(false)
    })
})

describe('#cleanEmail', () => {
    test('should clean and normalize email', () => {
        const result = cleanEmail('  John@EXAMPLE.COM  ')
        expect(result).toBe('john@example.com')
    })

    test('should extract and clean email from full format', () => {
        const result = cleanEmail('John Doe <JOHN@Example.Com>')
        expect(result).toBe('john@example.com')
    })
})

describe('#parseEmailList', () => {
    test('should parse comma-separated emails', () => {
        const result = parseEmailList('john@example.com, jane@example.com')
        expect(result).toEqual(['john@example.com', 'jane@example.com'])
    })

    test('should parse semicolon-separated emails', () => {
        const result = parseEmailList('john@example.com; jane@example.com')
        expect(result).toEqual(['john@example.com', 'jane@example.com'])
    })

    test('should filter out invalid emails', () => {
        const result = parseEmailList('john@example.com, invalid, jane@example.com')
        expect(result).toEqual(['john@example.com', 'jane@example.com'])
    })
})

describe('#formatEmailAddress', () => {
    test('should format with name', () => {
        const result = formatEmailAddress('john@example.com', 'John Doe')
        expect(result).toBe('"John Doe" <john@example.com>')
    })

    test('should return plain email without name', () => {
        const result = formatEmailAddress('john@example.com')
        expect(result).toBe('john@example.com')
    })
})

describe('#htmlToText', () => {
    test('should strip HTML tags', () => {
        const html = '<p>Hello <strong>World</strong></p>'
        const result = htmlToText(html)
        expect(result).toContain('Hello')
        expect(result).toContain('World')
        expect(result).not.toContain('<')
    })

    test('should decode HTML entities', () => {
        const html = '&amp; &lt; &gt; &quot;'
        const result = htmlToText(html)
        expect(result).toBe('& < > "')
    })

    test('should handle empty input', () => {
        expect(htmlToText('')).toBe('')
    })
})

describe('#isHtml', () => {
    test('should detect HTML content', () => {
        expect(isHtml('<p>Hello</p>')).toBe(true)
        expect(isHtml('<div>Content</div>')).toBe(true)
    })

    test('should return false for plain text', () => {
        expect(isHtml('Hello World')).toBe(false)
        expect(isHtml('')).toBe(false)
    })
})

describe('#extractThreadId', () => {
    test('should extract from references array', () => {
        const references = ['<msg1@example.com>', '<msg2@example.com>']
        const result = extractThreadId(references)
        expect(result).toBe('<msg1@example.com>')
    })

    test('should extract from references string', () => {
        const references = '<msg1@example.com> <msg2@example.com>'
        const result = extractThreadId(references)
        expect(result).toBe('<msg1@example.com>')
    })

    test('should fall back to inReplyTo', () => {
        const result = extractThreadId(undefined, '<reply@example.com>')
        expect(result).toBe('<reply@example.com>')
    })

    test('should return undefined when no data', () => {
        const result = extractThreadId(undefined, undefined)
        expect(result).toBeUndefined()
    })
})

describe('#isReplySubject', () => {
    test('should detect reply subjects', () => {
        expect(isReplySubject('Re: Hello')).toBe(true)
        expect(isReplySubject('RE: Hello')).toBe(true)
        expect(isReplySubject('re: Hello')).toBe(true)
        expect(isReplySubject('Aw: Hello')).toBe(true) // German
        expect(isReplySubject('Sv: Hello')).toBe(true) // Swedish
    })

    test('should return false for non-reply subjects', () => {
        expect(isReplySubject('Hello')).toBe(false)
        expect(isReplySubject('Meeting Request')).toBe(false)
        expect(isReplySubject('')).toBe(false)
    })
})

describe('#stripReplyPrefix', () => {
    test('should strip reply prefix', () => {
        expect(stripReplyPrefix('Re: Hello')).toBe('Hello')
        expect(stripReplyPrefix('RE:  Hello')).toBe('Hello')
    })

    test('should not modify non-reply subjects', () => {
        expect(stripReplyPrefix('Hello')).toBe('Hello')
    })
})

describe('#addReplyPrefix', () => {
    test('should add reply prefix', () => {
        expect(addReplyPrefix('Hello')).toBe('Re: Hello')
    })

    test('should not add prefix if already present', () => {
        expect(addReplyPrefix('Re: Hello')).toBe('Re: Hello')
    })

    test('should handle empty subject', () => {
        expect(addReplyPrefix('')).toBe('Re:')
    })
})

describe('#parseMimeType', () => {
    test('should parse simple MIME type', () => {
        const result = parseMimeType('text/plain')
        expect(result.type).toBe('text')
        expect(result.subtype).toBe('plain')
    })

    test('should parse MIME type with parameters', () => {
        const result = parseMimeType('text/plain; charset=utf-8')
        expect(result.type).toBe('text')
        expect(result.subtype).toBe('plain')
        expect(result.parameters.charset).toBe('utf-8')
    })

    test('should handle empty input', () => {
        const result = parseMimeType('')
        expect(result.type).toBe('text')
        expect(result.subtype).toBe('plain')
    })
})

describe('#mimeToExtension', () => {
    test('should return correct extension for known types', () => {
        expect(mimeToExtension('text/plain')).toBe('txt')
        expect(mimeToExtension('text/html')).toBe('html')
        expect(mimeToExtension('application/pdf')).toBe('pdf')
        expect(mimeToExtension('image/jpeg')).toBe('jpg')
        expect(mimeToExtension('image/png')).toBe('png')
    })

    test('should return subtype for unknown types', () => {
        expect(mimeToExtension('application/unknown')).toBe('unknown')
    })
})
