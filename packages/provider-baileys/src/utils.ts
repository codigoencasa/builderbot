/**
 * LAYER: Infrastructure
 * Contains: Utils, WriteStream
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [Utils, WriteStream]
 * GOAL: Own the "utils" concern of the provider-baileys package.
 */
import { utils } from '@builderbot/bot'
import type { ProviderContentType } from '@builderbot/bot/dist/types'
import type { WriteStream } from 'fs'
import { createWriteStream } from 'fs'
import { emptyDir } from 'fs-extra'
import * as qr from 'qr-image'

const emptyDirSessions = async (pathBase: string) =>
    new Promise((resolve, reject) => {
        emptyDir(pathBase, (err) => {
            if (err) reject(err)
            resolve(true)
        })
    })
/**
 * Cleans and normalizes a WhatsApp JID.
 * Supports @s.whatsapp.net, @g.us (groups), and @lid (Local Identifiers).
 * @param number - Raw JID or phone number
 * @param full - If true, strips the suffix and returns only the number/id part
 */
const baileyCleanNumber = (number: string, full: boolean = false): string => {
    if (!number) return ''

    // Groups: always return as-is
    if (number.includes('@g.us')) return number

    // LID (Local Identifiers): always preserve the @lid suffix
    // so sendMessage/resolveNumber can detect and route correctly
    if (number.includes('@lid')) return number

    // Standard phone numbers
    const raw = number.replace('@s.whatsapp.net', '').replace('+', '').replace(/\s/g, '')
    return full ? raw : `${raw}@s.whatsapp.net`
}

/**
 * Generates an image from a base64 string.
 * @param base64 The base64 string to generate the image from.
 * @param name The name of the file to write the image to.
 */
const baileyGenerateImage = async (base64: string, name: string = 'qr.png'): Promise<void> => {
    const PATH_QR: string = `${process.cwd()}/${name}`
    const qr_svg = qr.image(base64, { type: 'png', margin: 4 })

    const writeFilePromise = (): Promise<boolean> =>
        new Promise((resolve, reject) => {
            const file: WriteStream = qr_svg.pipe(createWriteStream(PATH_QR))
            file.on('finish', () => resolve(true))
            file.on('error', reject)
        })

    await writeFilePromise()
    await utils.cleanImage(PATH_QR)
}

/**
 * Validates if the given number is a valid WhatsApp number and not a group ID.
 * @param rawNumber The number to validate.
 * @returns True if it's a valid number, false otherwise.
 */
const baileyIsValidNumber = (rawNumber: string): boolean => {
    if (!rawNumber || rawNumber.trim() === '') return false
    const regexGroup: RegExp = /\@g.us\b/gm
    const exist = rawNumber.match(regexGroup)
    return !exist
}

/**
 * Maps a Baileys message content to the canonical ProviderContentType (RFC 0003).
 * Pure classification: reads only the message keys, never mutates.
 * @param message - The `message` branch of a WAMessage (may be undefined)
 * @returns The canonical content type, 'unknown' when nothing matches
 */
const baileyContentType = (message: any): ProviderContentType => {
    if (!message || typeof message !== 'object') return 'unknown'
    if (message.conversation || message.extendedTextMessage) return 'text'
    if (message.imageMessage) return 'image'
    if (message.videoMessage) return 'video'
    if (message.audioMessage) return 'audio'
    if (message.documentMessage || message.documentWithCaptionMessage) return 'document'
    if (message.stickerMessage) return 'sticker'
    if (message.locationMessage || message.liveLocationMessage) return 'location'
    if (message.contactMessage || message.contactsArrayMessage) return 'contact'
    if (message.orderMessage) return 'order'
    if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3) return 'poll'
    if (message.buttonsResponseMessage) return 'button'
    if (message.listResponseMessage) return 'list'
    if (message.reactionMessage) return 'reaction'
    return 'unknown'
}

export { baileyCleanNumber, baileyContentType, baileyGenerateImage, baileyIsValidNumber, emptyDirSessions }
