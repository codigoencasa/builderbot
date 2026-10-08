/**
 * LAYER: Infrastructure
 * Contains: GupshupCloudMedia, GupshupCloudMessage, GupshupSessionMediaType
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(n) score:3
 * keywords: [GupshupCloudMedia, GupshupCloudMessage, GupshupSessionMediaType]
 * GOAL: Own the "media" concern of the provider-gupshup package.
 */
import mime from 'mime-types'
import { basename } from 'path'

import type { GupshupCloudMedia, GupshupCloudMessage, GupshupSessionMediaType } from '../types'

const GUPSHUP_CLOUD_MEDIA_KEYS = ['image', 'document', 'audio', 'video', 'sticker'] as const

type GupshupCloudMediaKey = (typeof GUPSHUP_CLOUD_MEDIA_KEYS)[number]

export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const resolvePathFromInput = (mediaInput: string): string => {
    if (!isHttpUrl(mediaInput)) return mediaInput

    try {
        const url = new URL(mediaInput)
        return url.pathname
    } catch {
        return mediaInput
    }
}

export const inferSessionMediaTypeFromInput = (
    mediaInput: string,
    fallback: GupshupSessionMediaType = 'image'
): GupshupSessionMediaType => {
    const pathFromInput = resolvePathFromInput(mediaInput)
    const mimeType = mime.lookup(pathFromInput)

    if (typeof mimeType !== 'string') return fallback

    if (mimeType.startsWith('image/')) {
        const extension = mime.extension(mimeType)
        return extension === 'webp' ? 'sticker' : 'image'
    }

    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'

    return 'file'
}

export const extractFileNameFromInput = (mediaInput: string, fallback = 'file'): string => {
    const pathFromInput = resolvePathFromInput(mediaInput)
    const fileName = basename(pathFromInput)
    return fileName || fallback
}

const findCloudMedia = (
    message: GupshupCloudMessage
): {
    type: GupshupCloudMediaKey
    media: GupshupCloudMedia
} | null => {
    for (const mediaType of GUPSHUP_CLOUD_MEDIA_KEYS) {
        const media = message[mediaType]
        if (media?.url || media?.id) {
            return {
                type: mediaType,
                media,
            }
        }
    }

    return null
}

export const resolveCloudMediaUrl = (message: GupshupCloudMessage): string => {
    const mediaEntry = findCloudMedia(message)
    return mediaEntry?.media.url ?? ''
}

export const resolveCloudMediaId = (message: GupshupCloudMessage): string => {
    const mediaEntry = findCloudMedia(message)
    return mediaEntry?.media.id ?? ''
}

export const resolveCloudMediaMeta = (message: GupshupCloudMessage): Partial<GupshupCloudMedia> => {
    const mediaEntry = findCloudMedia(message)
    if (!mediaEntry) return {}

    return {
        id: mediaEntry.media.id,
        mime_type: mediaEntry.media.mime_type,
        filename: mediaEntry.media.filename,
        caption: mediaEntry.media.caption,
        sha256: mediaEntry.media.sha256,
    }
}
