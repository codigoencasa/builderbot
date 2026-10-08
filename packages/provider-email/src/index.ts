/**
 * LAYER: Infrastructure
 * Contains: Src
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Src]
 * GOAL: Own the "src" concern of the provider-email package.
 */
export { EmailProvider } from './email/provider'
export { EmailCoreVendor } from './email/core'
export type {
    IEmailProviderArgs,
    ImapConfig,
    SmtpConfig,
    EmailBotContext,
    EmailSendOptions,
    EmailAttachment,
    ParsedEmail,
    EmailVendorEvents,
} from './types'
export type { EmailInterface } from './interface/email'
export * from './utils'
