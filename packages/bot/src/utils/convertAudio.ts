import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
ffmpeg.setFfmpegPath(ffmpegInstaller.path)

interface FormatOptions {
    code: string
    ext: string
}

const formats: Record<string, FormatOptions> = {
    mp3: {
        code: 'libmp3lame',
        ext: 'mp3',
    },
    opus: {
        code: 'libopus',
        ext: 'opus',
    },
}

const convertAudio = async (filePath: string, format: keyof typeof formats = 'opus'): Promise<string> => {
    if (!filePath) {
        throw new Error('filePath is required')
    }

    const opusFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, path.extname(filePath))}.${formats[format].ext}`
    )

    await new Promise<void>((resolve, reject) => {
        ffmpeg(filePath)
            .audioCodec(formats[format].code)
            .audioBitrate('64k')
            .format(formats[format].ext)
            .output(opusFilePath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run()
    })

    return opusFilePath
}

export { convertAudio }
