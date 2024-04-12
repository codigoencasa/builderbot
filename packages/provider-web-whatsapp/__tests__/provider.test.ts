import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { WebWhatsappProvider } from '../src/index'
import { Client } from 'whatsapp-web.js'
import { utils } from '@builderbot/bot'
import mime from 'mime-types'

jest.mock('@builderbot/bot')

describe('#WebWhatsappProvider', () => {
    let webWhatsappProvider: WebWhatsappProvider

    beforeEach(() => {
        const args = { name: 'bot', gifPlayback: false }
        webWhatsappProvider = new WebWhatsappProvider(args)
    })

    describe('#initVendor', () => {
        test('initVendor initializes the vendor correctly', async () => {
            // Arrange

            // Act
            const result = await webWhatsappProvider['initVendor']()

            // Assert
            expect(result).toBeInstanceOf(Client)
        })
    })

    describe('#sendMessage', () => {
        test('Send text message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, world!'
            const options = {}
            const mockSendText = jest.fn().mockImplementation(() => 'Text message sent')
            webWhatsappProvider.vendor = {
                sendMessage: mockSendText,
            } as any
            jest.spyOn(webWhatsappProvider, 'sendButtons')
            jest.spyOn(webWhatsappProvider, 'sendMedia')
            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, options)

            // Assert
            expect(mockSendText).toHaveBeenCalledWith('1234567890@c.us', fakeMessage)
            expect(webWhatsappProvider.sendButtons).not.toHaveBeenCalled()
            expect(webWhatsappProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send message with buttons', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Choose an option:'
            const fakeButtons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const fakeOptions = { buttons: fakeButtons }
            jest.spyOn(webWhatsappProvider, 'sendButtons').mockImplementation(() => true as any)
            jest.spyOn(webWhatsappProvider, 'sendMedia')

            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(webWhatsappProvider.sendButtons).toHaveBeenCalledWith('1234567890@c.us', fakeMessage, fakeButtons)
            expect(webWhatsappProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send media message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Here is a media file'
            const fakeMedia = 'path/to/media.jpg'
            const fakeOptions = { media: fakeMedia }
            jest.spyOn(webWhatsappProvider, 'sendButtons')
            jest.spyOn(webWhatsappProvider, 'sendMedia').mockImplementation(() => true as any)

            // Act
            await webWhatsappProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(webWhatsappProvider.sendMedia).toHaveBeenCalledWith('1234567890@c.us', fakeMedia, fakeMessage)
            expect(webWhatsappProvider.sendButtons).not.toHaveBeenCalled()
        })
    })

    describe('#sendMedia', () => {
        test('should send image when provided with image URL', async () => {
            // Arrange
            const number = '+123456789'
            const imageUrl = 'https://example.com/image.jpg'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/image.jpg'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('image/jpeg')
            const sendImageSpy = jest
                .spyOn(webWhatsappProvider, 'sendImage')
                .mockImplementation(async () => true as any)

            // Act
            await webWhatsappProvider.sendMedia(number, imageUrl, text)

            // Assert
            expect(sendImageSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(imageUrl)
        })

        test('should send video when provided with video URL', async () => {
            // Arrange
            const number = '+123456789'
            const videoUrl = 'https://example.com/video.mp4'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/audio.mp3'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('video/mp4')
            const sendVideoSpy = jest
                .spyOn(webWhatsappProvider, 'sendVideo')
                .mockImplementation(async () => true as any)

            // Act
            await webWhatsappProvider.sendMedia(number, videoUrl, text)

            // Assert
            expect(sendVideoSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(videoUrl)
        })

        test('should send audio when provided with audio URL', async () => {
            // Arrange
            const number = '+123456789'
            const audioUrl = 'https://example.com/audio.mp3'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/audio.mp3'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('audio/mp3')
            const sendAudioSpy = jest
                .spyOn(webWhatsappProvider, 'sendAudio')
                .mockImplementation(async () => undefined as any)
            // Act
            await webWhatsappProvider.sendMedia(number, audioUrl, text)

            // Assert
            expect(sendAudioSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(audioUrl)
        })

        test('should send file when provided with file URL', async () => {
            // Arrange
            const number = '+123456789'
            const fileUrl = 'https://example.com/test.pdf'
            const text = 'Hello World'
            const fileDownloaded = 'path/to/downloaded/test.pdf'
            ;(utils.generalDownload as jest.MockedFunction<typeof utils.generalDownload>).mockResolvedValue(
                fileDownloaded
            )
            jest.spyOn(mime, 'lookup').mockReturnValue('text/plain')
            const sendFileSpy = jest
                .spyOn(webWhatsappProvider, 'sendFile')
                .mockImplementation(async () => undefined as any)
            // Act
            await webWhatsappProvider.sendMedia(number, fileUrl, text)
            // Assert
            expect(sendFileSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(fileUrl)
        })
    })
})
