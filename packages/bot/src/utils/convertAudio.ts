/**
 * LAYER: Infrastructure
 * Contains: convertAudio / FormatOptions — audio transcoding via ffmpeg
 * Rules: Wraps an external binary. No business rules.
 * BigO: O(1) score:5
 * keywords: [convertAudio, FormatOptions, processIncomingMessage]
 * GOAL: Convert incoming audio to the format the runtime expects.
 */
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

export interface FormatOptions {
    code: string
    ext: 'mp4' | 'ogg' | 'mp3'
}

const formats: Record<string, FormatOptions> = {
    mp3: {
        code: 'libmp3lame',
        ext: 'mp3',
    },
    ogg: {
        code: 'libopus',
        ext: 'ogg',
    },
    mp4: {
        code: 'aac',
        ext: 'mp4',
    },
}

const convertAudio = async (filePath: string, format: FormatOptions['ext'] = 'ogg'): Promise<string> => {
    if (!filePath) {
        throw new Error('filePath is required')
    }
    const outputFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.${formats[format].ext}`
    )

    await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg(filePath)
            .audioCodec(formats[format].code)
            .audioBitrate(format === 'ogg' ? '32k' : '64k')
            .format(formats[format].ext)
            .output(outputFilePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))

        if (format === 'ogg') {
            cmd.audioChannels(1).audioFrequency(48000).outputOptions(['-application voip', '-frame_duration 20'])
        }

        cmd.run()
    })

    return outputFilePath
}

export { convertAudio }
