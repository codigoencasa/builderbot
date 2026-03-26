import { readFileSync } from 'fs'
import { extname } from 'path'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.opus', '.wav', '.m4a', '.aac'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.avi', '.mov', '.mkv', '.webm'])
const PDF_EXTENSIONS = new Set(['.pdf'])

/** Convierte un archivo a base64 */
export const fileToBase64 = (filePath: string): string => {
    const buffer = readFileSync(filePath)
    return buffer.toString('base64')
}

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const MEDIA_TYPE_MAP: Record<string, ImageMediaType> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
}

/** Obtiene el media type de una imagen por su extension */
export const getImageMediaType = (filePath: string): ImageMediaType => {
    const ext = extname(filePath).toLowerCase()
    return MEDIA_TYPE_MAP[ext] || 'image/jpeg'
}

export const isImageFile = (filePath: string): boolean => {
    const ext = extname(filePath).toLowerCase()
    return IMAGE_EXTENSIONS.has(ext)
}

export const isAudioFile = (filePath: string): boolean => {
    const ext = extname(filePath).toLowerCase()
    return AUDIO_EXTENSIONS.has(ext)
}

export const isVideoFile = (filePath: string): boolean => {
    const ext = extname(filePath).toLowerCase()
    return VIDEO_EXTENSIONS.has(ext)
}

export const isPdfFile = (filePath: string): boolean => {
    const ext = extname(filePath).toLowerCase()
    return PDF_EXTENSIONS.has(ext)
}
