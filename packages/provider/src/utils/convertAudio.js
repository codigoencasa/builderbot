const ffmpeg = require('fluent-ffmpeg')
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
const path = require('path')
/**
 *
 * @param {*} filePath
 */
const convertAudio = async (filePath = null) => {
    const opusFilePath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}.opus`)
    await new Promise((resolve, reject) => {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path)
        ffmpeg(filePath)
            .audioCodec('libopus')
            .audioBitrate('64k')
            .format('opus')
            .output(opusFilePath)
            .on('end', resolve)
            .on('error', reject)
            .run()
    })
    return opusFilePath
}

module.exports = { convertAudio }
