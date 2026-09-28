/**
 * LAYER: Infrastructure
 * Contains: Utils
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Utils]
 * GOAL: Own the "utils" concern of the provider-email package.
 */
export {
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
    generateMessageId,
    parseMimeType,
    mimeToExtension,
} from './parser'
