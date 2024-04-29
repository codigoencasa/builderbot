import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'
import mime from 'mime-types'
import { utils } from '@builderbot/bot'
import { MetaProvider } from '../src/meta/provider'
import { Localization, MetaGlobalVendorArgs, MetaList, ParsedContact, WhatsAppProfile } from '../src/types'
import { downloadFile } from '../src/utils'

jest.mock('axios')

jest.mock('../src/utils', () => ({
    downloadFile: jest.fn(),
    getProfile: jest.fn(),
}))

jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}))

jest.mock('@builderbot/bot')

describe('#MetaProvider', () => {
    let metaProvider: MetaProvider
    beforeEach(() => {
        metaProvider = new MetaProvider({
            name: 'bot',
            jwtToken: 'your_jwt_token',
            numberId: '1234567890',
            verifyToken: 'your_verify_token',
            version: 'v18.0',
            port: 3000,
            writeMyself: 'none',
        })
    })

    describe('#afterHttpServerInit', () => {
        test('should emit "ready" event when successfully initialized', async () => {
            // Arrange
            const fakeProfile: WhatsAppProfile = {
                display_phone_number: '+1234567890',
                verified_name: '',
                code_verification_status: '',
                quality_rating: '',
                platform_type: '',
                throughput: {
                    level: '',
                },
                id: '',
            }
            const fakeArgs: MetaGlobalVendorArgs = {
                version: 'v18.0',
                numberId: '1234567890',
                jwtToken: 'fakeJwtToken',
                verifyToken: 'ddldldl',
            }
            metaProvider.globalVendorArgs = fakeArgs
            ;(require('../src/utils').getProfile as jest.Mock).mockImplementation(() => fakeProfile)
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.vendor = { emit: mockEmit }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            await metaProvider['afterHttpServerInit']()

            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ready')
        })

        test('should emit "notice" event with error message when initialization fails', async () => {
            // Arrange
            const errorMessage = 'Error connecting to META'
            const mockGetProfile = new Error(errorMessage)
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)
            ;(require('../src/utils').getProfile as jest.Mock).mockImplementation(() => mockGetProfile)

            const noticeSpy = jest.spyOn(metaProvider, 'emit')

            // Act
            await metaProvider['afterHttpServerInit']()

            // Assert
            expect(noticeSpy).toHaveBeenCalledWith('notice', {
                title: '🟠 ERROR AUTH  🟠',
                instructions: [
                    `Error connecting to META, make sure you have the correct credentials, .env`,
                    `https://builderbot.vercel.app/en/providers/meta`,
                ],
            })
        })
    })

    describe('#sendMessageToApi', () => {
        test('should send message to API and return response data', async () => {
            // Arrange
            const fakeBody = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: '1234567890',
                type: 'text',
                text: {
                    preview_url: false,
                    body: 'Hello, World!',
                },
            }
            const fakeResponseData = { messageId: '123456' }
            const fakeUrl = `https://graph.facebook.com/v18.0/1234567890/messages`
            const fakeJwtToken = 'your_jwt_token'

            const axiosResponse = {
                data: fakeResponseData,
            }
            ;(axios.post as jest.MockedFunction<typeof axios.get>).mockResolvedValue(axiosResponse)

            // Act
            const responseData = await metaProvider.sendMessageToApi(fakeBody)

            // Assert
            expect(axios.post).toHaveBeenCalledWith(fakeUrl, fakeBody, {
                headers: { Authorization: `Bearer ${fakeJwtToken}` },
            })
            expect(responseData).toEqual(fakeResponseData)
        })
    })

    describe('#sendMessageMeta', () => {
        test('should add message to queue and send it to API', async () => {
            // Arrange
            const fakeBody = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: '1234567890',
                type: 'text',
                text: {
                    preview_url: false,
                    body: 'Hello, World!',
                },
            }
            const fakeResponseData = { messageId: '123456' }

            jest.spyOn(metaProvider, 'sendMessageToApi').mockResolvedValue(() => fakeResponseData)

            const mockQueueAdd = jest.fn()

            metaProvider.queue.add = mockQueueAdd
            // Act
            metaProvider.sendMessageMeta(fakeBody)
            // Assert
            expect(metaProvider.queue.add).toHaveBeenCalled()
        })
    })

    describe('#sendText', () => {
        test('should send text message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, World!'
            metaProvider.sendMessageMeta = jest.fn()

            // Act
            await metaProvider.sendText(fakeRecipient, fakeMessage)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'text',
                text: {
                    preview_url: false,
                    body: fakeMessage,
                },
            })
        })
    })

    describe('#sendLocation', () => {
        test('should send location message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeLocalization: Localization = {
                // long_number: 123.456,
                // lat_number: 78.90,
                name: 'Test Location',
                address: 'Test Address',
                long_number: '123.456',
                lat_number: '78.90',
            }
            metaProvider.sendMessageMeta = jest.fn()

            // Act
            await metaProvider.sendLocation(fakeRecipient, fakeLocalization)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'location',
                location: {
                    name: fakeLocalization.name,
                    address: fakeLocalization.address,
                    longitude: fakeLocalization.long_number,
                    latitude: fakeLocalization.lat_number,
                },
            })
        })
    })

    describe('#sendLocationRequest', () => {
        test('should send location request message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeText = 'Please share your location'
            metaProvider.sendMessageMeta = jest.fn()

            // Act
            await metaProvider.sendLocationRequest(fakeRecipient, fakeText)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'interactive',
                interactive: {
                    type: 'location_request_message',
                    body: {
                        text: fakeText,
                    },
                    action: {
                        name: 'send_location',
                    },
                },
            })
        })
    })

    describe('#sendReaction', () => {
        test('should send reaction message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeReaction = {
                message_id: 'abcdef123456',
                emoji: '😄',
            }

            metaProvider.sendMessageMeta = jest.fn()

            // Act
            await metaProvider.sendReaction(fakeRecipient, fakeReaction)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'reaction',
                reaction: {
                    message_id: fakeReaction.message_id,
                    emoji: fakeReaction.emoji,
                },
            })
        })
    })

    describe('#sendAudio', () => {
        test('should send audio message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakePathVideo: any = 'path/to/audio.mp3'

            metaProvider.sendMessageMeta = jest.fn()

            // Act
            await metaProvider.sendAudio(fakeRecipient, fakePathVideo)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'audio',
                audio: {
                    id: undefined,
                },
            })
        })

        test('should throw an error if pathVideo is null', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakePathVideo = null

            // Act & Assert
            await expect(metaProvider.sendAudio(fakeRecipient, fakePathVideo)).rejects.toThrowError(
                'MEDIA_INPUT_NULL_: null'
            )
        })

        test('should log a message for unsupported media types', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakePathVideo: any = 'path/to/audio.ogg'
            const consoleSpy = jest.spyOn(console, 'log')

            // Act
            await metaProvider.sendAudio(fakeRecipient, fakePathVideo)

            // Assert
            expect(consoleSpy).toHaveBeenCalledWith(
                `Format (audio/ogg) not supported, you should use\nhttps://developers.facebook.com/docs/whatsapp/cloud-api/reference/media#supported-media-types`
            )

            consoleSpy.mockRestore()
        })
    })

    describe('#sendFile', () => {
        test('should throw an error if mediaInput is null', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMediaInput = null
            const fakeCaption = 'This is a file'

            // Act & Assert
            await expect(metaProvider.sendFile(fakeRecipient, fakeMediaInput, fakeCaption)).rejects.toThrowError(
                'MEDIA_INPUT_NULL_: null'
            )
        })

        test('should send file message to the provided recipient', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMediaInput: any = 'path/to/file.pdf'
            const fakeCaption = 'This is a file'
            const fakeMimeType = 'application/pdf'
            const fakeNameOriginal = 'file.pdf'

            metaProvider.sendMessageMeta = jest.fn()

            const formDataMock = {
                append: jest.fn(),
            }
            jest.spyOn(metaProvider, 'sendMessageMeta')

            jest.mock('form-data', () => ({
                __esModule: true,
                default: jest.fn(() => formDataMock),
            }))

            jest.mock('mime-types', () => ({
                lookup: jest.fn(() => fakeMimeType),
            }))

            // Act
            await metaProvider.sendFile(fakeRecipient, fakeMediaInput, fakeCaption)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'document',
                document: {
                    id: undefined,
                    filename: fakeNameOriginal,
                    caption: fakeCaption,
                },
            })
        })
    })

    describe('#sendMessage', () => {
        test('should parse the recipient number and send text message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Hello, world!'
            const options = {}
            jest.spyOn(metaProvider, 'sendText')
            jest.spyOn(metaProvider, 'sendButtons')
            jest.spyOn(metaProvider, 'sendMedia')
            // Act
            await metaProvider.sendMessage(fakeRecipient, fakeMessage, options)

            // Assert
            expect(metaProvider.sendText).toHaveBeenCalledWith(fakeRecipient, fakeMessage)
            expect(metaProvider.sendButtons).not.toHaveBeenCalled()
            expect(metaProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send message with buttons', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Choose an option:'
            const fakeButtons = [{ body: 'Option 1' }, { body: 'Option 2' }]
            const fakeOptions = { buttons: fakeButtons }

            jest.spyOn(metaProvider, 'sendButtons')
            jest.spyOn(metaProvider, 'sendText')
            jest.spyOn(metaProvider, 'sendMedia')

            // Act
            await metaProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(metaProvider.sendButtons).toHaveBeenCalledWith(fakeRecipient, fakeButtons, fakeMessage)
            expect(metaProvider.sendText).not.toHaveBeenCalled()
            expect(metaProvider.sendMedia).not.toHaveBeenCalled()
        })

        test('should parse the recipient number and send media message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMessage = 'Here is a media file'
            const fakeMedia = 'path/to/media.jpg'
            const fakeOptions = { media: fakeMedia }
            jest.spyOn(metaProvider, 'sendButtons')
            jest.spyOn(metaProvider, 'sendText')
            jest.spyOn(metaProvider, 'sendMedia').mockResolvedValue()

            // Act
            await metaProvider.sendMessage(fakeRecipient, fakeMessage, fakeOptions)

            // Assert
            expect(metaProvider.sendMedia).toHaveBeenCalledWith(fakeRecipient, fakeMessage, fakeMedia)
            expect(metaProvider.sendText).not.toHaveBeenCalled()
            expect(metaProvider.sendButtons).not.toHaveBeenCalled()
        })
    })

    describe('#sendCatalog', () => {
        test('should parse the recipient number and send catalog message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeText = 'Check out our latest catalog!'
            const fakeItemCatalogId = 'catalog123'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendCatalog(fakeRecipient, fakeText, fakeItemCatalogId)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'interactive',
                interactive: {
                    type: 'catalog_message',
                    body: {
                        text: fakeText,
                    },
                    action: {
                        name: 'catalog_message',
                        parameters: {
                            thumbnail_product_retailer_id: fakeItemCatalogId,
                        },
                    },
                },
            })
        })
    })

    describe('#sendContacts', () => {
        test('should parse the recipient number and send contacts message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeContacts: ParsedContact[] = [
                {
                    name: {
                        formatted_name: '',
                        first_name: '',
                    },
                    phones: [],
                },
            ]

            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendContacts(fakeRecipient, fakeContacts)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'contacts',
                contacts: fakeContacts,
            })
        })

        test('should parse the recipient number and send empty contacts message if no contacts provided', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendContacts(fakeRecipient)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'contacts',
                contacts: [],
            })
        })
    })

    describe('#sendFlow', () => {
        test('should parse the recipient number and send flow message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeHeaderText = 'Welcome to our flow!'
            const fakeBodyText = 'Please follow the steps in the flow.'
            const fakeFooterText = 'Thank you for using our service!'
            const fakeFlowId = 'flow123'
            const fakeFlowCta = 'Start Flow'
            const fakeScreenName = 'HomeScreen'
            const fakeData = { userId: 'user123' }
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendFlow(
                fakeRecipient,
                fakeHeaderText,
                fakeBodyText,
                fakeFooterText,
                fakeFlowId,
                fakeFlowCta,
                fakeScreenName,
                fakeData
            )

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalled()
        })
    })

    describe('#sendTemplate', () => {
        test('should send a template message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeTemplate = 'welcome_template'
            const fakeLanguageCode = 'en_US'
            const fakeComponents: any = [{ type: 'text', text: 'Welcome to our service!' }]
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendTemplate(fakeRecipient, fakeTemplate, fakeLanguageCode, fakeComponents)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'template',
                template: {
                    name: fakeTemplate,
                    language: {
                        code: fakeLanguageCode,
                    },
                    components: fakeComponents,
                },
            })
        })

        test('should send a template message component empty', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeTemplate = 'welcome_template'
            const fakeLanguageCode = 'en_US'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendTemplate(fakeRecipient, fakeTemplate, fakeLanguageCode)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'template',
                template: {
                    name: fakeTemplate,
                    language: {
                        code: fakeLanguageCode,
                    },
                    components: [],
                },
            })
        })
    })

    describe('#sendButtonsMedia', () => {
        test('should send a media message with buttons', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeMediaType = 'image'
            const fakeButtons: any = [
                { id: 1, body: 'Button 1' },
                { id: 2, body: 'Button 2' },
            ]
            const fakeText = 'Please select an option:'
            const fakeUrl = 'https://example.com/image.jpg'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendButtonsMedia(fakeRecipient, fakeMediaType, fakeButtons, fakeText, fakeUrl)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalled()
        })
    })

    describe('#sendButtonUrl', () => {
        test('should send a button with a URL', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeButton = { id: 1, body: 'Click here', url: 'https://example.com' }
            const fakeText = 'Please click the button:'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendButtonUrl(fakeRecipient, fakeButton, fakeText)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'interactive',
                interactive: {
                    type: 'cta_url',
                    body: {
                        text: fakeText,
                    },
                    action: {
                        name: 'cta_url',
                        parameters: {
                            display_text: fakeButton.body.slice(0, 15),
                            url: fakeButton.url,
                        },
                    },
                },
            })
        })
    })

    describe('#sendListComplete', () => {
        test('should send a complete list message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeHeader = 'List Header'
            const fakeText = 'This is the body of the list.'
            const fakeFooter = 'List Footer'
            const fakeButton = 'View More'
            const fakeList = [
                {
                    title: 'Section 1',
                    rows: [
                        { id: 1, title: 'Item 1', description: 'Description of Item 1' },
                        { id: 2, title: 'Item 2', description: 'Description of Item 2' },
                    ],
                },
                {
                    title: 'Section 2',
                    rows: [
                        { id: 3, title: 'Item 3', description: 'Description of Item 3' },
                        { id: 4, title: 'Item 4', description: 'Description of Item 4' },
                    ],
                },
            ]
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendListComplete(fakeRecipient, fakeHeader, fakeText, fakeFooter, fakeButton, fakeList)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: {
                        type: 'text',
                        text: fakeHeader,
                    },
                    body: {
                        text: fakeText,
                    },
                    footer: {
                        text: fakeFooter,
                    },
                    action: {
                        button: fakeButton,
                        sections: fakeList.map((section) => ({
                            title: section.title,
                            rows: section.rows.map((row) => ({
                                id: row.id,
                                title: row.title,
                                description: row.description,
                            })),
                        })),
                    },
                },
            })
        })
    })

    describe('#sendList', () => {
        test('should send a list message', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeList: MetaList = {
                header: { type: 'text', text: 'List Header' },
                body: { text: 'This is the body of the list.' },
                footer: { text: 'List Footer' },
                action: { button: 'View More', sections: [] },
            }
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendList(fakeRecipient, fakeList)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    header: fakeList.header,
                    body: fakeList.body,
                    footer: fakeList.footer,
                    action: fakeList.action,
                },
            })
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
            const sendImageSpy = jest.spyOn(metaProvider, 'sendImage').mockImplementation(async () => undefined)

            // Act
            await metaProvider.sendMedia(number, text, imageUrl)

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
            const sendVideoSpy = jest.spyOn(metaProvider, 'sendVideo').mockImplementation(async () => undefined)

            // Act
            await metaProvider.sendMedia(number, text, videoUrl)
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
            const sendAudioSpy = jest.spyOn(metaProvider, 'sendAudio').mockImplementation(async () => undefined)
            // Act
            await metaProvider.sendMedia(number, text, audioUrl)

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
            const sendFileSpy = jest.spyOn(metaProvider, 'sendFile').mockImplementation(async () => undefined)
            // Act
            await metaProvider.sendMedia(number, text, fileUrl)

            // Assert
            expect(sendFileSpy).toHaveBeenCalled()
            expect(utils.generalDownload).toHaveBeenCalledWith(fileUrl)
        })
    })

    describe('#sendVideoUrl', () => {
        test('should send a video message with caption', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeUrl = 'https://example.com/video.mp4'
            const fakeCaption = 'This is a video caption'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendVideoUrl(fakeRecipient, fakeUrl, fakeCaption)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'video',
                video: {
                    link: fakeUrl,
                    caption: fakeCaption,
                },
            })
        })
    })

    describe('#sendVideo', () => {
        test('should send a video message with caption', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakePathVideo: any = '/path/to/video.mp4'
            const fakeCaption = 'This is a video caption'

            jest.spyOn(metaProvider, 'sendMessageMeta')
            ;(axios.post as jest.MockedFunction<typeof axios.get>).mockResolvedValue({ data: { id: 'fakeMediaId' } })

            // Act
            await metaProvider.sendVideo(fakeRecipient, fakePathVideo, fakeCaption)

            // Assert
            expect(axios.post).toHaveBeenCalled()
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'video',
                video: {
                    id: 'fakeMediaId',
                    caption: fakeCaption,
                },
            })
        })

        test('should throw an error if pathVideo is null', async () => {
            // Arrange
            const fakeRecipient = '1234567890'

            // Act & Assert
            await expect(metaProvider.sendVideo(fakeRecipient, null, 'This is a video caption')).rejects.toThrowError(
                'MEDIA_INPUT_NULL_: null'
            )
        })
    })

    describe('#sendImageUrl', () => {
        test('should send an image message with caption', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakeImageUrl = 'https://example.com/image.jpg'
            const fakeCaption = 'This is an image caption'
            jest.spyOn(metaProvider, 'sendMessageMeta')

            // Act
            await metaProvider.sendImageUrl(fakeRecipient, fakeImageUrl, fakeCaption)

            // Assert
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: fakeRecipient,
                type: 'image',
                image: {
                    link: fakeImageUrl,
                    caption: fakeCaption,
                },
            })
        })
    })

    describe('#sendImage ', () => {
        test('should send a image message with caption', async () => {
            // Arrange
            const fakeRecipient = '1234567890'
            const fakePathImage: any = '/path/to/image.png'
            const fakeCaption = 'This is a video caption'

            jest.spyOn(metaProvider, 'sendMessageMeta')
            ;(axios.post as jest.MockedFunction<typeof axios.get>).mockResolvedValue({ data: { id: 'fakeMediaId' } })

            // Act
            await metaProvider.sendImage(fakeRecipient, fakePathImage, fakeCaption)

            // Assert
            expect(axios.post).toHaveBeenCalled()
            expect(metaProvider.sendMessageMeta).toHaveBeenCalledWith({
                messaging_product: 'whatsapp',
                to: fakeRecipient,
                type: 'image',
                image: {
                    id: 'fakeMediaId',
                    caption: fakeCaption,
                },
            })
        })

        test('should throw an error if pathImage is null', async () => {
            // Arrange
            const fakeRecipient = '1234567890'

            // Act & Assert
            await expect(metaProvider.sendImage(fakeRecipient, null, 'This is a image caption')).rejects.toThrowError(
                'MEDIA_INPUT_NULL_: null'
            )
        })
    })

    describe('#busEvents', () => {
        test('#auth_failure - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                message: 'Test',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            metaProvider['busEvents']()[0].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('auth_failure', payload)
        })

        test('#notice - should emit the correct events with payloads', async () => {
            // Arrange
            const noticePayload: any = { instructions: 'Some instructions', title: 'A notice title' }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            metaProvider['busEvents']()[1].func(noticePayload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('notice', noticePayload)
        })

        test('#ready - should emit the correct events with payloads', async () => {
            // Arrange
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            metaProvider['busEvents']()[2].func({} as any)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ready', true)
        })

        test('#message - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                body: 'Hellow Word!!',
                from: '123456789',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            metaProvider['busEvents']()[3].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('message', payload)
        })

        test('#host - should emit the correct events with payloads', async () => {
            // Arrange
            const payload: any = {
                message: 'Test',
            }
            const mockEmit = jest.fn()
            const mockEventEmitter = {
                emit: mockEmit,
            }
            metaProvider.emit = (mockEventEmitter as any).emit.bind(mockEventEmitter)

            // Act
            metaProvider['busEvents']()[4].func(payload)
            // Assert
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('host', payload)
        })
    })

    describe('#saveFile', () => {
        test('should save file successfully', async () => {
            // Arrange
            const ctx = { url: 'http://example.com/file.txt' }
            const options = { path: '/tmp' }

            const buffer = Buffer.from('file contents')
            const extension = 'txt'
            ;(require('../src/utils').downloadFile as jest.Mock).mockImplementation(() => ({ buffer, extension }))

            // Act
            const result = await metaProvider.saveFile(ctx, options)

            // Assert
            expect(downloadFile).toHaveBeenCalledWith(ctx?.url, 'your_jwt_token')
            expect(result).toContain(extension)
        })
    })
})
