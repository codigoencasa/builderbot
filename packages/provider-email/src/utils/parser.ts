/**
 * Email parsing utilities
 */

/**
 * Extract email address from a string that might contain name and email
 * e.g., "John Doe <john@example.com>" -> "john@example.com"
 */
export function extractEmailAddress(input: string): string {
    if (!input) return ''

    // Check if it contains angle brackets
    const match = input.match(/<([^>]+)>/)
    if (match) {
        return match[1].trim().toLowerCase()
    }

    // Return as-is if it looks like an email
    const trimmed = input.trim().toLowerCase()
    if (isValidEmail(trimmed)) {
        return trimmed
    }

    return trimmed
}

/**
 * Extract name from email string
 * e.g., "John Doe <john@example.com>" -> "John Doe"
 */
export function extractEmailName(input: string): string {
    if (!input) return ''

    // Check if it contains angle brackets
    const bracketIndex = input.indexOf('<')
    if (bracketIndex > 0) {
        return input
            .substring(0, bracketIndex)
            .trim()
            .replace(/^["']|["']$/g, '')
    }

    return ''
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
    if (!email) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Clean and normalize email address
 */
export function cleanEmail(email: string): string {
    return extractEmailAddress(email).toLowerCase().trim()
}

/**
 * Parse email list (comma or semicolon separated)
 */
export function parseEmailList(input: string): string[] {
    if (!input) return []

    return input
        .split(/[,;]/)
        .map((email) => extractEmailAddress(email))
        .filter((email) => isValidEmail(email))
}

/**
 * Format email address with optional name
 */
export function formatEmailAddress(email: string, name?: string): string {
    if (name) {
        return `"${name}" <${email}>`
    }
    return email
}

/**
 * Extract plain text from HTML email content
 * Basic implementation - strips HTML tags
 */
export function htmlToText(html: string): string {
    if (!html) return ''

    return (
        html
            // Remove script and style tags with content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // Replace common block elements with newlines
            .replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
            // Remove remaining HTML tags
            .replace(/<[^>]+>/g, '')
            // Decode common HTML entities
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            // Clean up whitespace
            .replace(/\n\s*\n/g, '\n\n')
            .trim()
    )
}

/**
 * Check if content is likely HTML
 */
export function isHtml(content: string): boolean {
    if (!content) return false
    return /<[a-z][\s\S]*>/i.test(content)
}

/**
 * Extract thread ID from References or In-Reply-To headers
 */
export function extractThreadId(references?: string | string[], inReplyTo?: string): string | undefined {
    // Try references first (get the first/root message)
    if (references) {
        if (Array.isArray(references) && references.length > 0) {
            return references[0]
        }
        if (typeof references === 'string') {
            const refs = references.split(/\s+/).filter(Boolean)
            if (refs.length > 0) return refs[0]
        }
    }

    // Fall back to In-Reply-To
    if (inReplyTo) {
        return inReplyTo
    }

    return undefined
}

/**
 * Check if email subject indicates a reply
 */
export function isReplySubject(subject: string): boolean {
    if (!subject) return false
    const replyPrefixes = ['re:', 'r:', 'aw:', 'sv:', 'antw:', 'odp:']
    const lowerSubject = subject.toLowerCase().trim()
    return replyPrefixes.some((prefix) => lowerSubject.startsWith(prefix))
}

/**
 * Strip reply prefixes from subject
 */
export function stripReplyPrefix(subject: string): string {
    if (!subject) return ''
    return subject.replace(/^(re:|r:|aw:|sv:|antw:|odp:)\s*/i, '').trim()
}

/**
 * Add reply prefix to subject if not present
 */
export function addReplyPrefix(subject: string): string {
    if (!subject) return 'Re:'
    if (isReplySubject(subject)) return subject
    return `Re: ${subject}`
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(domain: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 10)
    return `<${timestamp}.${random}@${domain}>`
}

/**
 * Parse MIME content type
 */
export function parseMimeType(contentType: string): {
    type: string
    subtype: string
    parameters: Record<string, string>
} {
    if (!contentType) {
        return { type: 'text', subtype: 'plain', parameters: {} }
    }

    const parts = contentType.split(';')
    const [type, subtype] = (parts[0] || 'text/plain').split('/')
    const parameters: Record<string, string> = {}

    for (let i = 1; i < parts.length; i++) {
        const param = parts[i].trim()
        const eqIndex = param.indexOf('=')
        if (eqIndex > 0) {
            const key = param.substring(0, eqIndex).trim().toLowerCase()
            let value = param.substring(eqIndex + 1).trim()
            // Remove quotes
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1)
            }
            parameters[key] = value
        }
    }

    return {
        type: type?.toLowerCase() || 'text',
        subtype: subtype?.toLowerCase() || 'plain',
        parameters,
    }
}

/**
 * Get file extension from MIME type
 */
export function mimeToExtension(mimeType: string): string {
    const mimeMap: Record<string, string> = {
        'text/plain': 'txt',
        'text/html': 'html',
        'text/css': 'css',
        'text/javascript': 'js',
        'application/json': 'json',
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'application/xml': 'xml',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
    }

    const { type, subtype } = parseMimeType(mimeType)
    const fullType = `${type}/${subtype}`

    return mimeMap[fullType] || subtype || 'bin'
}
