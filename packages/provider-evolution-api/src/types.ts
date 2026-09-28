/**
 * LAYER: Domain
 * Contains: File, SaveFileOptions, MediaType, TextMessage
 * Rules: No external dependencies. Pure business logic.
 * BigO: O(1) score:5
 * keywords: [File, SaveFileOptions, MediaType, TextMessage]
 * GOAL: Own the "types" concern of the provider-evolution-api package.
 */
import type { GlobalVendorArgs } from '@builderbot/bot/dist/types'

// Core file type used by the provider
export class File {
    mime_type?: string
    sha256?: string
    id?: string
    voice?: boolean
    animated?: boolean
    filename?: string
    caption?: string
    link?: string
}

export interface SaveFileOptions {
    path?: string
}

/**
 * Possible types of media to send
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document'

/**
 * Base message structure for API requests
 */
interface BaseMessage {
    number: string
    delay: number
}

/**
 * Structure for text messages
 */
export interface TextMessage extends BaseMessage {
    text: string
}

/**
 * Structure for media messages
 */
export interface MediaMessage extends BaseMessage {
    media: string
    mimetype: string
    mediatype: MediaType
    caption?: string
    fileName?: string
}

/**
 * Standard API response structure
 */
export interface ApiResponse {
    key?: {
        remoteJid?: string
        fromMe?: boolean
        id?: string
    }
    status?: string
    message?: string
    error?: boolean
    [key: string]: any
}

// Provider configuration
export interface EvolutionGlobalVendorArgs extends GlobalVendorArgs {
    participant?: string
}

/**
 * Device metadata for message encryption
 */
export interface DeviceListMetadata {
    senderKeyHash: string
    senderTimestamp: string
    recipientKeyHash: string
    recipientTimestamp: string
}

/**
 * Context information for a message
 */
export interface MessageContextInfo {
    deviceListMetadata: DeviceListMetadata
    deviceListMetadataVersion: number
    messageSecret: string
}

/**
 * Types of messages that can be received
 */
export type MessageType =
    | 'conversation'
    | 'imageMessage'
    | 'videoMessage'
    | 'audioMessage'
    | 'documentMessage'
    | 'stickerMessage'
    | 'contactMessage'
    | 'locationMessage'
    | 'extendedTextMessage'
    | 'buttonResponseMessage'
    | 'templateButtonReplyMessage'
    | 'listResponseMessage'
    | 'reactionMessage'

/**
 * Possible sources for the webhook event
 */
export type MessageSource = 'android' | 'ios' | 'web' | 'desktop' | 'unknown'

/**
 * Possible message content types in a webhook
 */
export interface WebhookMessage {
    conversation?: string
    messageContextInfo?: MessageContextInfo
    // Other message types can be added as needed
}

/**
 * Status of a message
 */
export type MessageStatus = 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED'

/**
 * Main data payload of the webhook event
 */
export interface WebhookEventData {
    key: WebhookEvent
    pushName: string
    status: MessageStatus
    message: WebhookMessage
    messageType: MessageType
    messageTimestamp: number
    instanceId: string
    source: MessageSource
}

/**
 * Event types supported by the webhook
 */
export type WebhookEventType =
    | 'messages.upsert'
    | 'messages.update'
    | 'messages.delete'
    | 'presence.update'
    | 'contacts.update'
    | 'groups.update'
    | 'groups.upsert'
    | 'group-participants.update'
    | 'status.update'

/**
 * Complete webhook event structure
 */
export interface WebhookEvent {
    event: WebhookEventType
    instance: string
    data: WebhookEventData
    destination: string
    date_time: string
    sender: string
    server_url: string
    apikey: string
}
