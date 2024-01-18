import { promises as fsPromises } from 'fs'
import sharp from 'sharp'

/**
 * Agregar un borde alrededor para mejorar la lectura de QR
 * @param FROM - La ruta del archivo de imagen a limpiar
 * @returns Una promesa que se resuelve cuando la imagen ha sido procesada
 */
const cleanImage = async (FROM: string | null = null): Promise<void> => {
    if (!FROM) {
        throw new Error('No se proporcionó una ruta de archivo válida.')
    }

    const readBuffer = async (): Promise<Buffer> => {
        const data = await fsPromises.readFile(FROM)
        return Buffer.from(data)
    }

    const imgBuffer: Buffer = await readBuffer()

    return new Promise((resolve, reject) => {
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
}

export { cleanImage }
