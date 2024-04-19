import { promises as fsPromises } from 'fs'

/**
 * Add a border around to improve QR readability
 * @param FROM - The path of the image file to clean up
 * @returns A promise to be resolved when the image has been processed
 */
const cleanImage = async (FROM: string | null = null): Promise<void> => {
    if (!FROM) {
        throw new Error('A valid file path was not provided.')
    }

    const readBuffer = async (): Promise<Buffer> => {
        const data = await fsPromises.readFile(FROM)
        return Buffer.from(data)
    }

    const imgBuffer: Buffer = await readBuffer()

    try {
        return new Promise((resolve, reject) => {
            import('sharp').then(({ default: sharp }) => {
                sharp(imgBuffer)
                    .extend({
                        top: 15,
                        bottom: 15,
                        left: 15,
                        right: 15,
                        background: { r: 255, g: 255, b: 255, alpha: 1 },
                    })
                    .toFile(FROM, (err) => {
                        if (err) reject(err)
                        resolve()
                    })
            })
        })
    } catch (e) {
        console.log(`******** npm install sharp *******`)
        console.log(`Error:`, e)
        return Promise.reject(e)
    }
}

export { cleanImage }
